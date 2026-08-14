import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { StatusBanner } from '../../src/components/StatusBanner';
import { Colors, Radius, Spacing } from '../../src/constants/theme';
import { api } from '../../src/api/client';

// STATUS: LIVE — listings and job listings are fetched from
// GET /api/marketplace/listings and GET /api/marketplace/jobs
// on the real backend.

interface Listing {
  _id: string;
  title: string;
  price?: number;
  category?: string;
  sold?: boolean;
}

interface JobListing {
  _id: string;
  title: string;
  company?: string;
}

export default function MarketplaceScreen() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);
    try {
      const [listingsRes, jobsRes] = await Promise.all([
        api.get('/marketplace/listings'),
        api.get('/marketplace/jobs'),
      ]);
      setListings(listingsRes.data?.data ?? []);
      setJobs(jobsRes.data?.data ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not load the marketplace. Pull down to try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => load(true)} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Marketplace</Text>
      </View>
      <StatusBanner status="real" note="Listings and jobs are live from your account." />

      {error ? (
        <View style={styles.card}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <>
          <Text style={styles.sectionTitle}>Listings</Text>
          {listings.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardMuted}>No listings yet.</Text>
            </View>
          ) : (
            listings.map((item) => (
              <View key={item._id} style={styles.card}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <View style={styles.rowBetween}>
                  {item.category ? <Text style={styles.cardMuted}>{item.category}</Text> : <View />}
                  {typeof item.price === 'number' ? (
                    <Text style={styles.priceText}>KSh {item.price.toLocaleString()}</Text>
                  ) : null}
                </View>
                {item.sold ? <Text style={styles.soldTag}>Sold</Text> : null}
              </View>
            ))
          )}

          <Text style={styles.sectionTitle}>Jobs & internships</Text>
          {jobs.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardMuted}>No job listings yet.</Text>
            </View>
          ) : (
            jobs.map((job) => (
              <View key={job._id} style={styles.card}>
                <Text style={styles.cardTitle}>{job.title}</Text>
                {job.company ? <Text style={styles.cardMuted}>{job.company}</Text> : null}
              </View>
            ))
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: Spacing.md,
    paddingTop: Spacing.xl,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  card: {
    backgroundColor: Colors.white,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  cardMuted: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  errorText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  priceText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
  soldTag: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.danger,
    marginTop: Spacing.xs,
  },
});
