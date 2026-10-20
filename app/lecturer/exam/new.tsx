import { useLocalSearchParams } from 'expo-router';
import ExamForm from '../../../src/components/ExamForm';
import KeyboardSafe from '../../../src/components/KeyboardSafe';

export default function NewExamScreen() {
  const { courseId } = useLocalSearchParams<{ courseId?: string }>();
  return <KeyboardSafe>
<ExamForm defaultCourseId={courseId} />
</KeyboardSafe>;
}
