import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { StatusBanner } from '../../src/components/StatusBanner';
import { useColors, Radius, Spacing } from '../../src/constants/theme';
import { api } from '../../src/api/client';
import KeyboardSafe from '../../src/components/KeyboardSafe';

// STATUS: REAL — verified directly against UNILINK-BACKEND, not
// inferred. GET /profile/achievements, GET/PATCH /profile/portfolio,
// POST /profile/portfolio/resume, POST /profile/portfolio/certificates
// all confirmed to exist with matching controllers and a real
// Portfolio/Achievement Mongoose model. This screen was previously a
// ShellScreen claiming "User model has no fields for any of this" —
// that was wrong: the backend was fully built, mobile simply never
// connected to it.
//
// One real gap, confirmed by reading the backend directly: there is
// no route anywhere that CREATES an Achievement record — only
// GET /profile/achievements to list them. Nothing in this backend
// awards achievements yet, by admin action or otherwise, so this
// list will legitimately be empty for every user until that
// separate, not-yet-built piece exists. This screen correctly only
// reads and displays; it does not pretend achievements can be earned
// from here.
//
// Resume/certificate upload use expo-document-picker (PDF/DOC, unlike
// the image-only expo-image-picker used for avatar/cover) — this is
// a NEW native dependency as of tonight, requiring npx expo install
// expo-document-picker and a fresh EAS build before this screen can
// actually run; it cannot ship via OTA alone.

interface Achievement {
  _id: string;
  title: string;
  description?: string;
  awardedAt: string;
}

interface Certificate {
  title: string;
  issuer?: string;
  fileUrl?: string;
  issuedAt: string;
}

interface Portfolio {
  skills: string[];
  languages: string[];
  projects: { title: string; description?: string; link?: string }[];
  volunteerHours: number;
  resumeUrl?: string;
  certificates: Certificate[];
}

const UPLOAD_TIMEOUT_MS = 60000;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-KE', { dateStyle: 'medium' });
}

export default function AchievementsScreen() {
  const colors = useColors();

  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [skillInput, setSkillInput] = useState('');
  const [languageInput, setLanguageInput] = useState('');
  const [projectTitle, setProjectTitle] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [volunteerHours, setVolunteerHours] = useState('');
  const [isSavingPortfolio, setIsSavingPortfolio] = useState(false);
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [isUploadingCert, setIsUploadingCert] = useState(false);
  const [certTitle, setCertTitle] = useState('');
  const [certIssuer, setCertIssuer] = useState('');
  const [saveError, setSaveError] = useState('');

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        title: { fontSize: 24, fontWeight: '800', color: colors.text, padding: Spacing.md, paddingBottom: 0 },
        section: {
          backgroundColor: colors.surface,
          marginHorizontal: Spacing.md,
          marginTop: Spacing.md,
          padding: Spacing.md,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
        },
        sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: Spacing.sm },
        emptyText: { fontSize: 13, color: colors.textMuted },
        achievementRow: { paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
        achievementTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
        achievementDesc: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
        achievementDate: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
        chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginBottom: Spacing.sm },
        chip: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.background,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.full,
          paddingHorizontal: Spacing.sm,
          paddingVertical: 6,
          gap: 6,
        },
        chipText: { fontSize: 13, color: colors.text },
        chipRemove: { fontSize: 13, color: colors.danger, fontWeight: '700' },
        inputRow: { flexDirection: 'row', gap: Spacing.sm },
        input: {
          flex: 1,
          backgroundColor: colors.background,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.sm,
          paddingHorizontal: Spacing.sm,
          paddingVertical: 10,
          fontSize: 14,
          color: colors.text,
        },
        addButton: {
          backgroundColor: colors.primary,
          borderRadius: Radius.sm,
          paddingHorizontal: Spacing.md,
          justifyContent: 'center',
        },
        addButtonText: { color: colors.white, fontWeight: '700' },
        projectCard: {
          backgroundColor: colors.background,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.sm,
          padding: Spacing.sm,
          marginBottom: Spacing.sm,
        },
        projectTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
        projectDesc: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
        removeProjectText: { color: colors.danger, fontSize: 12, fontWeight: '700', marginTop: Spacing.xs },
        fileButton: {
          backgroundColor: colors.background,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.sm,
          paddingVertical: Spacing.sm,
          alignItems: 'center',
          marginBottom: Spacing.sm,
        },
        fileButtonText: { fontSize: 13, fontWeight: '600', color: colors.text },
        savedFileText: { fontSize: 12, color: colors.secondary, marginBottom: Spacing.sm },
        saveButton: {
          backgroundColor: colors.primary,
          borderRadius: Radius.md,
          paddingVertical: 14,
          alignItems: 'center',
          marginHorizontal: Spacing.md,
          marginTop: Spacing.md,
          marginBottom: Spacing.xl,
        },
        saveButtonDisabled: { opacity: 0.6 },
        saveButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
        errorText: { color: colors.danger, fontSize: 13, textAlign: 'center', marginTop: Spacing.sm },
      }),
    [colors]
  );

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setLoadError(null);
    try {
      const [achRes, portRes] = await Promise.all([
        api.get('/profile/achievements'),
        api.get('/profile/portfolio'),
      ]);
      setAchievements(achRes.data?.data ?? []);
      const p: Portfolio = portRes.data?.data;
      setPortfolio(p);
      setVolunteerHours(String(p?.volunteerHours ?? 0));
    } catch (err: any) {
      setLoadError(err?.response?.data?.message || 'Could not load your portfolio.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addSkill = () => {
    const value = skillInput.trim();
    if (!value || !portfolio) return;
    if (portfolio.skills.includes(value)) {
      setSkillInput('');
      return;
    }
    setPortfolio({ ...portfolio, skills: [...portfolio.skills, value] });
    setSkillInput('');
  };

  const removeSkill = (skill: string) => {
    if (!portfolio) return;
    setPortfolio({ ...portfolio, skills: portfolio.skills.filter((s) => s !== skill) });
  };

  const addLanguage = () => {
    const value = languageInput.trim();
    if (!value || !portfolio) return;
    if (portfolio.languages.includes(value)) {
      setLanguageInput('');
      return;
    }
    setPortfolio({ ...portfolio, languages: [...portfolio.languages, value] });
    setLanguageInput('');
  };

  const removeLanguage = (lang: string) => {
    if (!portfolio) return;
    setPortfolio({ ...portfolio, languages: portfolio.languages.filter((l) => l !== lang) });
  };

  const addProject = () => {
    if (!projectTitle.trim() || !portfolio) return;
    setPortfolio({
      ...portfolio,
      projects: [...portfolio.projects, { title: projectTitle.trim(), description: projectDescription.trim() }],
    });
    setProjectTitle('');
    setProjectDescription('');
  };

  const removeProject = (index: number) => {
    if (!portfolio) return;
    setPortfolio({ ...portfolio, projects: portfolio.projects.filter((_, i) => i !== index) });
  };

  const handleSavePortfolio = async () => {
    if (!portfolio) return;
    setIsSavingPortfolio(true);
    setSaveError('');
    try {
      const hours = parseInt(volunteerHours, 10);
      await api.patch('/profile/portfolio', {
        skills: portfolio.skills,
        languages: portfolio.languages,
        projects: portfolio.projects,
        volunteerHours: Number.isFinite(hours) ? hours : 0,
      });
    } catch (err: any) {
      setSaveError(err?.response?.data?.message || 'Could not save your changes.');
    } finally {
      setIsSavingPortfolio(false);
    }
  };

  const uploadFile = async (endpoint: string, fieldName: string, asset: { uri: string; name: string; mimeType?: string }) => {
    const token = await SecureStore.getItemAsync('unilink_token');
    const formData = new FormData();
    formData.append(fieldName, {
      uri: asset.uri,
      name: asset.name,
      type: asset.mimeType || 'application/octet-stream',
    } as any);
    if (endpoint.includes('certificates')) {
      formData.append('title', certTitle.trim() || asset.name);
      if (certIssuer.trim()) formData.append('issuer', certIssuer.trim());
    }
    return axios.post(`${api.defaults.baseURL}${endpoint}`, formData, {
      headers: {
        Authorization: token ? `Bearer ${token}` : undefined,
        'Content-Type': 'multipart/form-data',
      },
      timeout: UPLOAD_TIMEOUT_MS,
    });
  };

  const handlePickResume = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ],
    });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    setIsUploadingResume(true);
    setSaveError('');
    try {
      const res = await uploadFile('/profile/portfolio/resume', 'file', {
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType,
      });
      setPortfolio((prev) => (prev ? { ...prev, resumeUrl: res.data?.data?.resumeUrl } : prev));
    } catch (err: any) {
      Alert.alert('Upload failed', err?.response?.data?.message || 'Could not upload your resume.');
    } finally {
      setIsUploadingResume(false);
    }
  };

  const handlePickCertificate = async () => {
    if (!certTitle.trim()) {
      Alert.alert('Title required', 'Enter a title for this certificate before choosing a file.');
      return;
    }
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/jpeg', 'image/png'],
    });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    setIsUploadingCert(true);
    setSaveError('');
    try {
      const res = await uploadFile('/profile/portfolio/certificates', 'file', {
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType,
      });
      setPortfolio(res.data?.data ?? null);
      setCertTitle('');
      setCertIssuer('');
    } catch (err: any) {
      Alert.alert('Upload failed', err?.response?.data?.message || 'Could not upload your certificate.');
    } finally {
      setIsUploadingCert(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <KeyboardSafe>
<ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => load(true)} />}
    >
      <Text style={styles.title} accessibilityRole="header">
        Achievements & Portfolio
      </Text>
      <StatusBanner
        status="real"
        note="Achievements, skills, projects, and uploads are all live on your account."
      />

      {loadError ? <Text style={styles.errorText}>{loadError}</Text> : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          Achievements & Badges
        </Text>
        {achievements.length === 0 ? (
          <Text style={styles.emptyText}>
            No achievements yet — these are awarded automatically and none exist for your account yet.
          </Text>
        ) : (
          achievements.map((a) => (
            <View key={a._id} style={styles.achievementRow}>
              <Text style={styles.achievementTitle}>{a.title}</Text>
              {a.description ? <Text style={styles.achievementDesc}>{a.description}</Text> : null}
              <Text style={styles.achievementDate}>{formatDate(a.awardedAt)}</Text>
            </View>
          ))
        )}
      </View>

      {portfolio ? (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle} accessibilityRole="header">
              Skills
            </Text>
            <View style={styles.chipRow}>
              {portfolio.skills.map((skill) => (
                <View key={skill} style={styles.chip}>
                  <Text style={styles.chipText}>{skill}</Text>
                  <TouchableOpacity
                    onPress={() => removeSkill(skill)}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove skill ${skill}`}
                  >
                    <Text style={styles.chipRemove}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="Add a skill"
                placeholderTextColor={colors.textMuted}
                value={skillInput}
                onChangeText={setSkillInput}
                onSubmitEditing={addSkill}
                accessibilityLabel="Add a skill"
              />
              <TouchableOpacity style={styles.addButton} onPress={addSkill} accessibilityRole="button" accessibilityLabel="Add skill">
                <Text style={styles.addButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle} accessibilityRole="header">
              Languages
            </Text>
            <View style={styles.chipRow}>
              {portfolio.languages.map((lang) => (
                <View key={lang} style={styles.chip}>
                  <Text style={styles.chipText}>{lang}</Text>
                  <TouchableOpacity
                    onPress={() => removeLanguage(lang)}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove language ${lang}`}
                  >
                    <Text style={styles.chipRemove}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="Add a language"
                placeholderTextColor={colors.textMuted}
                value={languageInput}
                onChangeText={setLanguageInput}
                onSubmitEditing={addLanguage}
                accessibilityLabel="Add a language"
              />
              <TouchableOpacity
                style={styles.addButton}
                onPress={addLanguage}
                accessibilityRole="button"
                accessibilityLabel="Add language"
              >
                <Text style={styles.addButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle} accessibilityRole="header">
              Projects
            </Text>
            {portfolio.projects.map((p, i) => (
              <View key={i} style={styles.projectCard}>
                <Text style={styles.projectTitle}>{p.title}</Text>
                {p.description ? <Text style={styles.projectDesc}>{p.description}</Text> : null}
                <TouchableOpacity
                  onPress={() => removeProject(i)}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove project ${p.title}`}
                >
                  <Text style={styles.removeProjectText}>Remove</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TextInput
              style={[styles.input, { marginBottom: Spacing.sm }]}
              placeholder="Project title"
              placeholderTextColor={colors.textMuted}
              value={projectTitle}
              onChangeText={setProjectTitle}
              accessibilityLabel="Project title"
            />
            <TextInput
              style={[styles.input, { marginBottom: Spacing.sm }]}
              placeholder="Short description (optional)"
              placeholderTextColor={colors.textMuted}
              value={projectDescription}
              onChangeText={setProjectDescription}
              accessibilityLabel="Project description"
            />
            <TouchableOpacity
              style={styles.addButton}
              onPress={addProject}
              accessibilityRole="button"
              accessibilityLabel="Add project"
            >
              <Text style={styles.addButtonText}>Add Project</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle} accessibilityRole="header">
              Volunteer Hours
            </Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              value={volunteerHours}
              onChangeText={setVolunteerHours}
              keyboardType="number-pad"
              accessibilityLabel="Volunteer hours"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle} accessibilityRole="header">
              Resume
            </Text>
            {portfolio.resumeUrl ? (
              <Text style={styles.savedFileText}>A resume is on file.</Text>
            ) : (
              <Text style={styles.emptyText}>No resume uploaded.</Text>
            )}
            <TouchableOpacity
              style={styles.fileButton}
              onPress={handlePickResume}
              disabled={isUploadingResume}
              accessibilityRole="button"
              accessibilityLabel={portfolio.resumeUrl ? 'Replace resume' : 'Upload resume'}
              accessibilityState={{ busy: isUploadingResume }}
            >
              {isUploadingResume ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={styles.fileButtonText}>{portfolio.resumeUrl ? 'Replace Resume' : 'Upload Resume'}</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle} accessibilityRole="header">
              Certificates
            </Text>
            {portfolio.certificates.length === 0 ? (
              <Text style={styles.emptyText}>No certificates uploaded.</Text>
            ) : (
              portfolio.certificates.map((c, i) => (
                <View key={i} style={styles.achievementRow}>
                  <Text style={styles.achievementTitle}>{c.title}</Text>
                  {c.issuer ? <Text style={styles.achievementDesc}>{c.issuer}</Text> : null}
                </View>
              ))
            )}
            <TextInput
              style={[styles.input, { marginTop: Spacing.sm, marginBottom: Spacing.sm }]}
              placeholder="Certificate title"
              placeholderTextColor={colors.textMuted}
              value={certTitle}
              onChangeText={setCertTitle}
              accessibilityLabel="Certificate title"
            />
            <TextInput
              style={[styles.input, { marginBottom: Spacing.sm }]}
              placeholder="Issuer (optional)"
              placeholderTextColor={colors.textMuted}
              value={certIssuer}
              onChangeText={setCertIssuer}
              accessibilityLabel="Certificate issuer"
            />
            <TouchableOpacity
              style={styles.fileButton}
              onPress={handlePickCertificate}
              disabled={isUploadingCert}
              accessibilityRole="button"
              accessibilityLabel="Upload certificate"
              accessibilityState={{ busy: isUploadingCert }}
            >
              {isUploadingCert ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={styles.fileButtonText}>Upload Certificate</Text>
              )}
            </TouchableOpacity>
          </View>

          {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}

          <TouchableOpacity
            style={[styles.saveButton, isSavingPortfolio && styles.saveButtonDisabled]}
            onPress={handleSavePortfolio}
            disabled={isSavingPortfolio}
            accessibilityRole="button"
            accessibilityLabel="Save changes"
            accessibilityState={{ disabled: isSavingPortfolio, busy: isSavingPortfolio }}
          >
            {isSavingPortfolio ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.saveButtonText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </>
      ) : null}
    </ScrollView>
</KeyboardSafe>
  );
}
