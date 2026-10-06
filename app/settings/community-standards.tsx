import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useColors, Radius, Spacing } from '../../src/constants/theme';

const STANDARDS = [
  {
    title: '1. Respect and harassment',
    body: 'Treat other students, lecturers, staff, and community members with respect. Do not harass, intimidate, stalk, threaten, or repeatedly target another person.',
  },
  {
    title: '2. Hate speech and discrimination',
    body: 'Do not attack, degrade, or exclude people because of protected or personal characteristics. UniLink is intended to remain welcoming to students from different backgrounds.',
  },
  {
    title: '3. Bullying',
    body: 'Do not use UniLink to bully, humiliate, repeatedly mock, or organize harassment against another person.',
  },
  {
    title: '4. Threats and violence',
    body: 'Threats of violence, encouragement of violence, or content intended to facilitate harm are not allowed. Genuine emergencies should be reported through the Emergency feature.',
  },
  {
    title: '5. Sexual and explicit content',
    body: 'Do not post or distribute sexually explicit, exploitative, or inappropriate content. Content involving minors is strictly prohibited.',
  },
  {
    title: '6. Spam and scams',
    body: 'Do not flood communities or messages with unwanted content, fraudulent offers, phishing attempts, fake promotions, or schemes intended to deceive other users.',
  },
  {
    title: '7. Impersonation',
    body: 'Do not pretend to be another student, lecturer, administrator, organization, or official UniLink representative in order to mislead others.',
  },
  {
    title: '8. Academic integrity',
    body: 'Do not use UniLink to facilitate cheating, plagiarism, examination fraud, unauthorized sharing of restricted examination materials, or other academic misconduct.',
  },
  {
    title: '9. Fraud and deception',
    body: 'Do not use UniLink to steal, defraud, manipulate, or deliberately deceive another person. Financial or marketplace activity must be represented honestly.',
  },
  {
    title: '10. Privacy and personal information',
    body: "Respect other people's privacy. Do not publish private contact details, private conversations, account credentials, or other personal information without appropriate permission.",
  },
  {
    title: '11. Doxxing',
    body: "Do not expose or distribute someone's private or sensitive information in order to identify, locate, intimidate, shame, or endanger them.",
  },
  {
    title: '12. Misleading information',
    body: 'Do not deliberately spread false or misleading information in a way that could cause harm, deceive users, disrupt a community, or impersonate an official announcement.',
  },
  {
    title: '13. Illegal activity',
    body: 'Do not use UniLink to plan, promote, facilitate, or coordinate unlawful activity.',
  },
  {
    title: '14. Platform manipulation',
    body: 'Do not manipulate follows, reactions, reports, polls, engagement, rankings, or other platform systems through fake accounts, coordinated abuse, automation, or other deceptive methods.',
  },
  {
    title: '15. Appropriate community use',
    body: 'Use communities for their intended academic, campus, social, or organizational purposes. Follow any additional rules established by the community while respecting these platform-wide standards.',
  },
  {
    title: '16. Reporting and moderation',
    body: 'If you encounter content or behaviour that violates these standards, use the available reporting tools. Do not misuse reports to target people simply because you disagree with them.',
  },
  {
    title: '17. Enforcement and appeals',
    body: 'Violations may result in content removal, restrictions, suspension, or account termination depending on severity and history. Where an appeal process is available, users may challenge an enforcement decision through the designated process.',
  },
];

export default function CommunityStandardsScreen() {
  const colors = useColors();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background,
        },
        content: {
          padding: Spacing.md,
          paddingBottom: Spacing.xl * 2,
        },
        header: {
          marginBottom: Spacing.lg,
        },
        title: {
          color: colors.text,
          fontSize: 26,
          fontWeight: '800',
          marginBottom: Spacing.sm,
        },
        intro: {
          color: colors.textMuted,
          fontSize: 14,
          lineHeight: 21,
        },
        notice: {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.md,
          padding: Spacing.md,
          marginBottom: Spacing.lg,
        },
        noticeTitle: {
          color: colors.text,
          fontSize: 15,
          fontWeight: '800',
          marginBottom: Spacing.xs,
        },
        noticeText: {
          color: colors.textMuted,
          fontSize: 13,
          lineHeight: 20,
        },
        standard: {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.md,
          padding: Spacing.md,
          marginBottom: Spacing.sm,
        },
        standardTitle: {
          color: colors.text,
          fontSize: 15,
          fontWeight: '800',
          marginBottom: Spacing.xs,
        },
        standardBody: {
          color: colors.textMuted,
          fontSize: 13,
          lineHeight: 20,
        },
        footer: {
          marginTop: Spacing.md,
          color: colors.textMuted,
          fontSize: 12,
          lineHeight: 18,
          textAlign: 'center',
        },
      }),
    [colors]
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Community Standards</Text>
        <Text style={styles.intro}>
          These standards apply across UniLink. They are designed to keep
          academic, campus, social, and messaging spaces safe and useful for
          everyone.
        </Text>
      </View>

      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>One platform standard</Text>
        <Text style={styles.noticeText}>
          Individual communities may establish additional guidelines for their
          members, but community-specific rules cannot override these
          platform-wide standards.
        </Text>
      </View>

      {STANDARDS.map((standard) => (
        <View key={standard.title} style={styles.standard}>
          <Text style={styles.standardTitle}>{standard.title}</Text>
          <Text style={styles.standardBody}>{standard.body}</Text>
        </View>
      ))}

      <Text style={styles.footer}>
        UniLink may update these standards as the platform evolves. Updated
        standards should be communicated to users through the appropriate
        in-app channels.
      </Text>
    </ScrollView>
  );
}
