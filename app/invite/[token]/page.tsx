import { prisma } from "@/lib/prisma";
import AcceptInviteClient from "@/components/AcceptInviteClient";

function InviteMessage({ title, text }: { title: string; text: string }) {
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1 className="display">{title}</h1>
        <p className="sub">{text}</p>
      </div>
    </div>
  );
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = await prisma.invitation.findUnique({ where: { token } });

  if (!invitation) {
    return (
      <InviteMessage
        title="Invite not found"
        text="This invite link isn't valid. Ask the company owner for a new one."
      />
    );
  }
  if (invitation.acceptedAt) {
    return <InviteMessage title="Already used" text="This invite has already been accepted." />;
  }
  if (invitation.expiresAt < new Date()) {
    return (
      <InviteMessage
        title="Invite expired"
        text="This invite link has expired. Ask the company owner to send a new one."
      />
    );
  }

  const company = await prisma.user.findUnique({
    where: { id: invitation.companyId },
    select: { companyName: true },
  });

  return <AcceptInviteClient token={token} companyName={company?.companyName ?? "this company"} />;
}
