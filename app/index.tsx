import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/store/authStore';

export default function Index() {
  const user = useAuthStore((s) => s.user);

  if (!user) {
    return <Redirect href="/auth/login" />;
  }

  const academicSetupComplete =
    user.role !== 'student' ||
    Boolean(
      user.universityId &&
      user.campusId &&
      user.programme?.trim() &&
      user.yearOfStudy &&
      user.semester
    );

  if (!academicSetupComplete) {
    return <Redirect href="/auth/academic-setup" />;
  }

  return <Redirect href="/(tabs)/home" />;
}
