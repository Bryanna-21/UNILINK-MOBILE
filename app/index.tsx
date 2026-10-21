import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/store/authStore';
import { api } from '../src/api/client';
import { LoadingSplash } from '../src/components/LoadingSplash';

// Academic setup is asked ONCE, when a student has not finished it. "Finished" must be something the
// server remembers, so it survives logging out and back in:
//   - onboardingCompletedAt: the server's own record that setup was completed, or
//   - for accounts that finished before that record existed: programme, year and semester.
// The old check also demanded a courseId, which the server never stores on the user, so every fresh
// login (which rebuilds the user from the server) failed it and sent the student back to setup.
function setupDone(u: any): boolean {
  if (!u || u.role !== 'student') return true;
  if (!u.universityId) return false;
  return Boolean(u.onboardingCompletedAt || (u.programme && u.yearOfStudy && u.semester));
}

export default function Index() {
  const user = useAuthStore((s) => s.user);
  const [checked, setChecked] = useState(false);

  // The login reply carries only a few fields. Before deciding that setup is missing, ask the server
  // for the full profile once, so a student who already finished is never sent back to it.
  useEffect(() => {
    let cancelled = false;
    if (!user || setupDone(user)) {
      setChecked(true);
      return;
    }
    api
      .get('/auth/me')
      .then((res) => {
        const me = res.data?.user;
        const current = useAuthStore.getState().user;
        if (me && current && !cancelled) useAuthStore.getState().setUser({ ...current, ...me });
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (!user) {
    return <Redirect href="/auth/login" />;
  }

  if (!setupDone(user)) {
    if (!checked) return <LoadingSplash />;
    return <Redirect href="/auth/academic-setup" />;
  }

  return <Redirect href="/(tabs)/home" />;
}
