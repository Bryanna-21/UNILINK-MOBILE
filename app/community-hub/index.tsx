import { ShellScreen } from '../../src/components/ShellScreen';

// STATUS: SHELL — none of these have a backend model. The spec
// grouped these as sibling concepts to the Post feed, but they're
// structurally different (a Club has members and an owner; a Poll
// has options and votes; a Study Group has a schedule) — each is
// its own model, not a variant of Post.

export default function CommunityHubScreen() {
  return (
    <ShellScreen
      title="Community Hub"
      subtitle="Clubs, Projects, Study Groups, Polls, Announcements"
      sections={[
        {
          title: 'Clubs',
          items: ['No clubs yet'],
          backendNote: 'Needs: Club model (name, description, members, owner), join/leave routes.',
        },
        {
          title: 'Projects',
          items: ['No projects listed'],
          backendNote: 'Needs: Project model, likely with a status field and contributor list.',
        },
        {
          title: 'Study Groups',
          items: ['No study groups'],
          backendNote: 'Needs: StudyGroup model with a schedule/meeting-time field.',
        },
        {
          title: 'Polls',
          items: ['No active polls'],
          backendNote: 'Needs: Poll model (question, options, votes) + a vote route with duplicate-vote prevention.',
        },
        {
          title: 'Announcements',
          items: ['No announcements'],
          backendNote: 'Needs: Announcement model, likely restricted to lecturer/admin roles to create.',
        },
      ]}
    />
  );
}
