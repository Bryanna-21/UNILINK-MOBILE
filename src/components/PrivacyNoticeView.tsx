import { Linking, StyleSheet, Text, View } from 'react-native';
import { Radius, Spacing, useColors } from '../constants/theme';
import { linkify } from '../utils/legalUi';
import type { PrivacyNotice } from '../api/legal';

// STATUS: REAL. Draws the Privacy Notice the server sends (GET /api/legal/privacy), the same text as the website.
// https links are tappable; everything is drawn as plain text, so notice text can never inject anything.

function Linked({ value, style }: { value: string; style: object }) {
  const colors = useColors();
  return (
    <Text style={style}>
      {linkify(value).map((part, i) =>
        part.type === 'link' ? (
          <Text key={i} style={{ color: colors.primary, textDecorationLine: 'underline' }} onPress={() => Linking.openURL(part.value).catch(() => {})} accessibilityRole="link">
            {part.value}
          </Text>
        ) : (
          <Text key={i}>{part.value}</Text>
        )
      )}
    </Text>
  );
}

export default function PrivacyNoticeView({ notice }: { notice: PrivacyNotice }) {
  const colors = useColors();
  const styles = StyleSheet.create({
    body: { fontSize: 15, lineHeight: 22, color: colors.text, marginTop: Spacing.sm },
    h2: { fontSize: 17, fontWeight: '800', color: colors.text, marginTop: Spacing.lg },
    bullet: { flexDirection: 'row', gap: 8, marginTop: 6, paddingRight: Spacing.md },
    dot: { fontSize: 15, color: colors.text, lineHeight: 22 },
    draft: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md },
    draftText: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  });

  return (
    <View>
      {notice.isDraft ? (
        <View style={styles.draft} accessibilityRole="alert">
          <Text style={styles.draftText}>This notice is still a draft and is being finished. It describes what the app really does today.</Text>
        </View>
      ) : null}
      {notice.intro ? <Linked value={notice.intro} style={styles.body} /> : null}
      {notice.sections.map((section) => (
        <View key={section.id}>
          <Text style={styles.h2} accessibilityRole="header">
            {section.number}. {section.title}
          </Text>
          {section.blocks.map((block, i) =>
            block.ul ? (
              <View key={i}>
                {block.ul.map((item, j) => (
                  <View key={j} style={styles.bullet}>
                    <Text style={styles.dot}>•</Text>
                    <View style={{ flex: 1 }}>
                      <Linked value={item} style={styles.body} />
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Linked key={i} value={block.p ?? ''} style={styles.body} />
            )
          )}
        </View>
      ))}
    </View>
  );
}
