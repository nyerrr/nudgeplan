import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { useCallback, useEffect, useRef, useState } from 'react';

interface VoiceInputOptions {
  /** Final transcript for a dictation session. */
  onTranscript: (transcript: string) => void;
  onError?: (message: string) => void;
}

const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed':
    'Microphone access was denied. Allow it in your device settings to use voice.',
  'service-not-allowed':
    'Speech recognition is not available on this device. You can still type.',
  'no-speech': "I didn't catch anything. Try again a little closer to the mic.",
  'audio-capture': 'No microphone was found. Check your device and try again.',
  network: 'Speech recognition needs a connection right now. You can still type.',
  aborted: '',
};

export function speechRecognitionAvailable(): boolean {
  try {
    return ExpoSpeechRecognitionModule.isRecognitionAvailable();
  } catch {
    return false;
  }
}

export function useVoiceInput({
  onTranscript,
  onResult,
  onError,
}: VoiceInputOptions & { onResult?: (transcript: string) => void }) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(() => speechRecognitionAvailable());
  const lastFinalRef = useRef('');

  useEffect(
    () => () => {
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch {
        // Recognition may already have stopped with the screen.
      }
    },
    [],
  );

  const handleTranscript = useCallback(
    (transcript: string) => {
      onTranscript?.(transcript);
      onResult?.(transcript);
    },
    [onResult, onTranscript],
  );

  useSpeechRecognitionEvent('start', () => {
    lastFinalRef.current = '';
    setListening(true);
  });
  useSpeechRecognitionEvent('end', () => setListening(false));

  useSpeechRecognitionEvent('result', (event) => {
    const results = (event as { results?: Array<{ transcript?: string; isFinal?: boolean }>; isFinal?: boolean }).results ?? [];
    const transcript = results
      .map((result) => result?.transcript ?? '')
      .join(' ')
      .trim()
      .replace(/\s+/g, ' ');
    if (!transcript) return;

    const isFinal =
      (event as { isFinal?: boolean }).isFinal ?? results.every((result) => result?.isFinal === true);
    if (!isFinal) return;

    if (transcript === lastFinalRef.current) return;
    lastFinalRef.current = transcript;
    handleTranscript(transcript);
  });

  useSpeechRecognitionEvent('error', (event) => {
    setListening(false);
    const message = ERROR_MESSAGES[event.error];
    if (message) onError?.(message);
    else if (event.error !== 'aborted') {
      onError?.('Voice input stopped. You can type instead.');
    }
  });

  const start = useCallback(async () => {
    try {
      lastFinalRef.current = '';
      const available = ExpoSpeechRecognitionModule.isRecognitionAvailable();
      setSupported(available);
      if (!available) {
        onError?.(
          'Voice input is not available here. In Expo Go, use a development build (or the web app) to dictate.',
        );
        return;
      }
      const permission =
        await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        onError?.(
          'Microphone or speech recognition permission was denied. You can still type.',
        );
        return;
      }
      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: false,
        continuous: false,
        requiresOnDeviceRecognition: false,
      });
    } catch {
      setListening(false);
      onError?.(
        'Voice input needs a development build on Android and iOS. The web app can dictate in Chrome or Edge.',
      );
    }
  }, [handleTranscript, onError]);

  const stop = useCallback(() => {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      setListening(false);
    }
  }, []);

  return { listening, start, stop, supported };
}
