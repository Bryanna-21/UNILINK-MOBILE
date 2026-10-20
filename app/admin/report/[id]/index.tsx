import { useLocalSearchParams } from 'expo-router';
import EmergencyReportDetail from '../../../../src/components/EmergencyReportDetail';
import KeyboardSafe from '../../../../src/components/KeyboardSafe';

export default function AdminReportDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <KeyboardSafe>
<EmergencyReportDetail reportId={id} />
</KeyboardSafe>;
}
