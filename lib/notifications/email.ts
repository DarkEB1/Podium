import { Resend } from 'resend'

function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  return new Resend(key)
}

function from(): string {
  return process.env.RESEND_FROM_EMAIL ?? 'noreply@getpodium.app'
}

export async function sendProposalReceivedEmail(
  to: string,
  proposalTitle: string,
  senderName: string
): Promise<void> {
  const client = getClient()
  if (!client) return

  await client.emails.send({
    from: from(),
    to,
    subject: `New proposal: ${proposalTitle}`,
    html: `<p>You have received a new proposal "<strong>${proposalTitle}</strong>" from ${senderName}.</p><p>Log in to Podium to review and respond.</p>`,
  })
}

export async function sendProposalRespondedEmail(
  to: string,
  proposalTitle: string,
  action: 'accepted' | 'declined' | 'countered',
  responderName: string
): Promise<void> {
  const client = getClient()
  if (!client) return

  const actionText = action === 'accepted' ? 'accepted' : action === 'declined' ? 'declined' : 'countered'
  const subject =
    action === 'accepted'
      ? `Proposal accepted: ${proposalTitle}`
      : action === 'countered'
      ? `Counter-proposal received: ${proposalTitle}`
      : `Proposal declined: ${proposalTitle}`

  await client.emails.send({
    from: from(),
    to,
    subject,
    html: `<p>${responderName} has <strong>${actionText}</strong> your proposal "<strong>${proposalTitle}</strong>".</p><p>Log in to Podium to view the details.</p>`,
  })
}

export async function sendContractFullySignedEmail(
  to: string,
  proposalTitle: string
): Promise<void> {
  const client = getClient()
  if (!client) return

  await client.emails.send({
    from: from(),
    to,
    subject: `Contract fully signed: ${proposalTitle}`,
    html: `<p>Great news! The contract for "<strong>${proposalTitle}</strong>" has been signed by all parties.</p><p>Log in to Podium to view your contract.</p>`,
  })
}
