import { useLocalSearchParams } from 'expo-router';
import ExamForm from '../../../../src/components/ExamForm';
import KeyboardSafe from '../../../../src/components/KeyboardSafe';

export default function EditExamScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <KeyboardSafe>
<ExamForm examId={id} />
</KeyboardSafe>;
}
