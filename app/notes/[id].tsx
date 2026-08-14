import { useLocalSearchParams } from 'expo-router';
import { ShellScreen } from '../../src/components/ShellScreen';

// STATUS: SHELL — no Note model, no file storage, no PDF viewer
// library installed. A real version needs a genuine architecture
// decision (where do PDF files live? Mongo GridFS? S3? Cloudinary?)
// before any code here matters.

export default function NoteReaderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <ShellScreen
      title="Note Reader"
      subtitle={`Note ID: ${id ?? 'unknown'} — placeholder`}
      sections={[
        {
          title: 'Reading Mode',
          items: ['Offline download', 'Bookmarks', 'Highlighting', 'Annotation', 'Dark mode', 'PDF viewer'],
          backendNote: 'Needs: Note model + file storage decision + a PDF rendering library (e.g. react-native-pdf) — none installed yet.',
        },
      ]}
    />
  );
}
