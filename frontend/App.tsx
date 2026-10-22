import { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  Platform.select({
    android: 'http://10.0.2.2:8001',
    default: 'http://localhost:8001',
  })!;

type PlanResult = {
  tasks: string[];
  breakdown: string;
  model?: string | null;
};

export default function App() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PlanResult | null>(null);

  async function plan() {
    if (!text.trim()) {
      setError('Type a brain dump first.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${API_URL}/ai/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail ?? 'Request failed');
      }
      setResult(data);
    } catch (e: any) {
      setError(e?.message ?? 'Network error. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>NudgePlan</Text>
        <Text style={styles.subtitle}>Dump your brain. Get a plan you can actually do.</Text>

        <TextInput
          style={styles.input}
          placeholder="I need to finish the report, pick up groceries, and email my professor..."
          placeholderTextColor="#7a7f8a"
          value={text}
          onChangeText={setText}
          multiline
          textAlignVertical="top"
        />

        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={plan}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Build my plan</Text>
          )}
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {result ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Today's steps</Text>
            {result.tasks.map((task, i) => (
              <View key={i} style={styles.taskRow}>
                <View style={styles.dot} />
                <Text style={styles.taskText}>{task}</Text>
              </View>
            ))}
            {result.breakdown ? (
              <Text style={styles.breakdown}>{result.breakdown}</Text>
            ) : null}
            {result.model ? (
              <Text style={styles.model}>model: {result.model}</Text>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1115',
  },
  content: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  title: {
    color: '#f5f7fa',
    fontSize: 32,
    fontWeight: '700',
  },
  subtitle: {
    color: '#9aa3b2',
    fontSize: 15,
    marginTop: 6,
    marginBottom: 24,
  },
  input: {
    backgroundColor: '#1a1d24',
    color: '#f5f7fa',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2a2e38',
    padding: 16,
    minHeight: 140,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#4f7cff',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  error: {
    color: '#ff7a7a',
    marginTop: 16,
    fontSize: 14,
  },
  card: {
    backgroundColor: '#1a1d24',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2a2e38',
    padding: 18,
    marginTop: 24,
  },
  cardTitle: {
    color: '#f5f7fa',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#4f7cff',
    marginTop: 6,
    marginRight: 10,
  },
  taskText: {
    color: '#d7dce4',
    fontSize: 15,
    flex: 1,
  },
  breakdown: {
    color: '#8b93a1',
    fontSize: 13,
    marginTop: 8,
    fontStyle: 'italic',
  },
  model: {
    color: '#5a6270',
    fontSize: 11,
    marginTop: 10,
  },
});
