import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyId } from "@/lib/session";
import { canEditData } from "@/lib/roles";
import { logActivity } from "@/lib/activity";
import { checkAndSendNegativeBalanceAlert } from "@/lib/alerts";
import { formatDateOnly } from "@/lib/forecast";
import {
  QBOPurchase,
  QBOSalesTransaction,
  isQuickBooksEnabled,
  mapPurchaseToExpenseRow,
  mapSalesTransactionToIncomeRow,
  queryQuickBooks,
} from "@/lib/quickbooks";

const MAX_DAYS = 365;
const DEFAULT_DAYS = 90;

function serializeItem<T extends { startDate: Date }>(item: T) {
  return { ...item, startDate: formatDateOnly(item.startDate) };
}

// Pulls recent Purchases (expenses) and Invoices/SalesReceipts (income) from the connected
// QuickBooks company and imports each as a one-time line item — see lib/quickbooks.ts for why
// "onetime" and why category/name come from the vendor or customer name. Dormant until
// QuickBooks is configured and the company has actually connected — see lib/quickbooks.ts.
export async function POST(req: Request) {
  if (!isQuickBooksEnabled()) {
    return NextResponse.json({ error: "QuickBooks isn't available yet." }, { status: 503 });
  }

  const session = await requireCompanyId();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditData(session.role)) {
    return NextResponse.json({ error: "Viewers can't import from QuickBooks." }, { status: 403 });
  }

  const connection = await prisma.quickBooksConnection.findUnique({ where: { userId: session.companyId } });
  if (!connection) {
    return NextResponse.json({ error: "This company hasn't connected QuickBooks yet." }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}) as { days?: number });
  const days = Math.min(MAX_DAYS, Math.max(1, Number(body?.days) || DEFAULT_DAYS));
  const since = formatDateOnly(new Date(Date.now() - days * 86400000));

  let purchases: { QueryResponse?: { Purchase?: QBOPurchase[] } };
  let sales: { QueryResponse?: { Invoice?: QBOSalesTransaction[] } };
  let cashSales: { QueryResponse?: { SalesReceipt?: QBOSalesTransaction[] } };
  try {
    [purchases, sales, cashSales] = await Promise.all([
      queryQuickBooks(session.companyId, `SELECT * FROM Purchase WHERE TxnDate >= '${since}' MAXRESULTS 1000`),
      queryQuickBooks(session.companyId, `SELECT * FROM Invoice WHERE TxnDate >= '${since}' MAXRESULTS 1000`),
      queryQuickBooks(session.companyId, `SELECT * FROM SalesReceipt WHERE TxnDate >= '${since}' MAXRESULTS 1000`),
    ]);
  } catch (err) {
    console.error("[quickbooks sync] query failed", err);
    return NextResponse.json({ error: "Couldn't reach QuickBooks. Try reconnecting." }, { status: 502 });
  }

  const expenseRows = (purchases.QueryResponse?.Purchase || []).map(mapPurchaseToExpenseRow).filter((r) => r !== null);
  const incomeRows = [
    ...(sales.QueryResponse?.Invoice || []).map((txn) => mapSalesTransactionToIncomeRow(txn, "Invoice")),
    ...(cashSales.QueryResponse?.SalesReceipt || []).map((txn) => mapSalesTransactionToIncomeRow(txn, "SalesReceipt")),
  ].filter((r) => r !== null);
  const totalFetched =
    (purchases.QueryResponse?.Purchase?.length || 0) +
    (sales.QueryResponse?.Invoice?.length || 0) +
    (cashSales.QueryResponse?.SalesReceipt?.length || 0);
  const unmappable = totalFetched - expenseRows.length - incomeRows.length;

  // Re-running a sync (the "Sync now" button has no reason not to be clicked more than once)
  // must never create duplicate line items for a transaction already imported — check what's
  // already here before inserting anything new.
  const alreadyImported = new Set(
    (
      await prisma.lineItem.findMany({
        where: { userId: session.companyId, quickBooksTxnId: { not: null } },
        select: { quickBooksTxnId: true },
      })
    ).map((i) => i.quickBooksTxnId)
  );
  const seenThisRun = new Set<string>();
  const rows = [...expenseRows, ...incomeRows].filter((row) => {
    if (alreadyImported.has(row.quickBooksTxnId) || seenThisRun.has(row.quickBooksTxnId)) return false;
    seenThisRun.add(row.quickBooksTxnId);
    return true;
  });
  const skipped = unmappable + (expenseRows.length + incomeRows.length - rows.length);

  if (rows.length === 0) {
    return NextResponse.json({ imported: 0, skipped, items: [] });
  }

  const created = await prisma.$transaction(
    rows.map((row) =>
      prisma.lineItem.create({
        data: {
          userId: session.companyId,
          type: row.type,
          category: row.category,
          name: row.name,
          amount: row.amount,
          frequency: row.frequency,
          startDate: new Date(`${row.startDate}T00:00:00`),
          lineLabel: row.lineLabel,
          quickBooksTxnId: row.quickBooksTxnId,
        },
      })
    )
  );

  await prisma.quickBooksConnection.update({ where: { userId: session.companyId }, data: { lastSyncedAt: new Date() } });
  await logActivity(
    session.companyId,
    session.userId,
    session.userEmail,
    "quickbooks.sync",
    `Imported ${created.length} item${created.length === 1 ? "" : "s"} from QuickBooks`
  );
  await checkAndSendNegativeBalanceAlert(session.companyId, new URL(req.url).origin);

  return NextResponse.json({ imported: created.length, skipped, items: created.map(serializeItem) });
}
