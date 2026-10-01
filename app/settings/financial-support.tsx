import { ShellScreen } from '../../src/components/ShellScreen';

// STATUS: SHELL — deliberately "coming soon". Reached from Settings >
// Financial Support. No backend exists, and the real design questions
// (who is eligible, who approves, how funds are verified and disbursed)
// are unanswered. They are listed below as open questions rather than
// invented as features. Replace this whole screen once they are decided.

export default function FinancialSupportScreen() {
  return (
    <ShellScreen
      title="Financial Support"
      subtitle="Coming soon"
      sections={[
        {
          title: 'Support requests',
          items: ['Apply for financial support', 'Track an application', 'Upload supporting documents'],
          backendNote:
            'Not built. Needs a SupportRequest model, document upload (the existing Cloudinary document middleware can be reused), and an admin review/approval flow. Eligibility rules and the approval process have not been decided yet.',
        },
        {
          title: 'Payments',
          items: ['Disbursement status', 'Payment history'],
          backendNote:
            'Not built, and not decided. Handling real money needs a payment provider integration and a compliance review. Do not prototype this against real funds.',
        },
      ]}
    />
  );
}
