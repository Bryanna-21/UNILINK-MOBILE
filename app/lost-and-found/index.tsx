import { ShellScreen } from '../../src/components/ShellScreen';

// STATUS: SHELL — no LostItem model on the backend.

export default function LostAndFoundScreen() {
  return (
    <ShellScreen
      title="Lost & Found"
      sections={[
        {
          title: 'Recent Reports',
          items: ['No items reported'],
          backendNote: 'Needs: LostItem model (item, location, date, contact, found/lost status).',
        },
        {
          title: 'Report an Item',
          items: ['Report lost item', 'Report found item'],
          backendNote: 'Needs: POST /api/lost-and-found route + image upload for item photos.',
        },
      ]}
    />
  );
}
