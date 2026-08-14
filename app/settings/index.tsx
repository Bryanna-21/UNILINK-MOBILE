import { ShellScreen } from '../../src/components/ShellScreen';

// STATUS: SHELL — no settings actually change app behavior yet.
// Each toggle needs real implementation (i18n library for languages,
// a theme context for dark mode, expo-notifications for push prefs).

export default function SettingsScreen() {
  return (
    <ShellScreen
      title="Settings"
      subtitle="None of these currently do anything"
      sections={[
        {
          title: 'Appearance',
          items: ['Dark mode', 'Theme'],
          backendNote: 'Needs: a theme context provider (no backend required, just unbuilt).',
        },
        {
          title: 'Notifications',
          items: ['Push notification preferences'],
          backendNote: 'Needs: expo-notifications + backend to actually trigger pushes.',
        },
        {
          title: 'Privacy & Security',
          items: ['Privacy settings', 'Security settings', 'Change password'],
          backendNote: 'Needs: dedicated settings routes on the User model.',
        },
        {
          title: 'Storage',
          items: ['Downloads', 'Storage usage'],
          backendNote: 'Needs: offline download feature to exist first.',
        },
        {
          title: 'Language',
          items: [
            'English', 'Swahili', 'French', 'Arabic', 'Spanish',
            'German', 'Chinese', 'Japanese', 'Portuguese', 'Russian',
          ],
          backendNote: 'Needs: an i18n library (e.g. i18next) + real translated strings for every screen — this is a large, real effort, not a dropdown.',
        },
        {
          title: 'Accessibility',
          items: ['Screen reader support', 'Large text', 'High contrast', 'Reduced motion'],
          backendNote: 'Needs: accessibility props added screen-by-screen (React Native has real APIs for this — genuine work, not a toggle).',
        },
      ]}
    />
  );
}
