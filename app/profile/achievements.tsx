import { ShellScreen } from '../../src/components/ShellScreen';

// STATUS: SHELL — User model has no fields for any of this.

export default function AchievementsScreen() {
  return (
    <ShellScreen
      title="Achievements & Portfolio"
      sections={[
        {
          title: 'Achievements & Badges',
          items: ['No achievements yet'],
          backendNote: 'Needs: Achievement model + criteria/award logic.',
        },
        {
          title: 'Skills & Certificates',
          items: ['No skills listed', 'No certificates uploaded'],
          backendNote: 'Needs: fields on User model or a separate Skill/Certificate model.',
        },
        {
          title: 'Portfolio & Resume',
          items: ['No portfolio items', 'No resume uploaded'],
          backendNote: 'Needs: Portfolio model + file storage for resume uploads.',
        },
        {
          title: 'Volunteer Hours & Projects',
          items: ['Nothing logged'],
          backendNote: 'Needs: dedicated tracking model.',
        },
      ]}
    />
  );
}
