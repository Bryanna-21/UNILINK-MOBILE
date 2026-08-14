import { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { StatusBanner } from '../../src/components/StatusBanner';
import { Colors, Radius, Spacing } from '../../src/constants/theme';
import { api } from '../../src/api/client';

// STATUS: LIVE — books and digital resources are fetched from
// GET /api/library/books and GET /api/library/digital on the real
// backend. Borrowing calls POST /api/library/books/:id/borrow.

interface Book {
  _id: string;
  title: string;
  author?: string;
  availableCopies?: number;
}

interface DigitalResource {
  _id: string;
  title: string;
  type?: string;
}

export default function LibraryScreen() {
  const [books, setBooks] = useState<Book[]>([]);
  const [digital, setDigital] = useState<DigitalResource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [borrowingId, setBorrowingId] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);
    try {
      const [booksRes, digitalRes] = await Promise.all([
        api.get('/library/books'),
        api.get('/library/digital'),
      ]);
      setBooks(booksRes.data?.data ?? []);
      setDigital(digitalRes.data?.data ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not load the library. Pull down to try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleBorrow = async (book: Book) => {
    setBorrowingId(book._id);
    try {
      await api.post(`/library/books/${book._id}/borrow`);
      Alert.alert('Borrowed', `"${book.title}" has been added to your loans.`);
      load(true);
    } catch (err: any) {
      Alert.alert('Could not borrow', err?.response?.data?.message || 'Please try again.');
    } finally {
      setBorrowingId(null);
    }
  };

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
        <Text style={styles.title}>Library</Text>
      </View>
      <StatusBanner status="real" note="Books and digital resources are live from your account." />

      {error ? (
        <View style={styles.card}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <>
          <Text style={styles.sectionTitle}>Physical books</Text>
          {books.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardMuted}>No books available yet.</Text>
            </View>
          ) : (
            books.map((book) => (
              <View key={book._id} style={styles.card}>
                <Text style={styles.cardTitle}>{book.title}</Text>
                {book.author ? <Text style={styles.cardMuted}>{book.author}</Text> : null}
                <View style={styles.rowBetween}>
                  <Text style={styles.cardMuted}>
                    {typeof book.availableCopies === 'number'
                      ? `${book.availableCopies} available`
                      : ''}
                  </Text>
                  <TouchableOpacity
                    style={styles.borrowButton}
                    disabled={borrowingId === book._id}
                    onPress={() => handleBorrow(book)}
                  >
                    <Text style={styles.borrowButtonText}>
                      {borrowingId === book._id ? 'Borrowing…' : 'Borrow'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}

          <Text style={styles.sectionTitle}>Digital library</Text>
          {digital.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardMuted}>No digital resources yet.</Text>
            </View>
          ) : (
            digital.map((res) => (
              <View key={res._id} style={styles.card}>
                <Text style={styles.cardTitle}>{res.title}</Text>
                {res.type ? <Text style={styles.cardMuted}>{res.type}</Text> : null}
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
  borrowButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
  },
  borrowButtonText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
});
