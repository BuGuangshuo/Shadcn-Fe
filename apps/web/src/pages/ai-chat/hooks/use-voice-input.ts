import * as React from 'react';
import { toast } from 'sonner';

import { VOICE_WAVEFORM_MIN_LEVEL } from '../constants';
import type { BrowserSpeechRecognition } from '../types';
import {
  createVoiceWaveformLevels,
  getAudioContextConstructor,
  getSpeechRecognitionConstructor,
  getVoiceInputErrorMessage,
  mergeVoiceTranscript,
} from '../utils';

export function useVoiceInput({
  input,
  onInputChange,
}: {
  input: string;
  onInputChange: (value: string) => void;
}) {
  const [isActive, setIsActive] = React.useState(false);
  const [transcript, setTranscript] = React.useState('');
  const [levels, setLevels] = React.useState(createVoiceWaveformLevels);
  const recognitionRef = React.useRef<BrowserSpeechRecognition | null>(null);
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const audioSourceRef = React.useRef<MediaStreamAudioSourceNode | null>(null);
  const mediaStreamRef = React.useRef<MediaStream | null>(null);
  const animationFrameRef = React.useRef<number | null>(null);
  const baseInputRef = React.useRef('');
  const draftTranscriptRef = React.useRef('');
  const finalTranscriptRef = React.useRef('');
  const isStoppingRef = React.useRef(false);

  const clearTranscript = React.useCallback(() => {
    draftTranscriptRef.current = '';
    finalTranscriptRef.current = '';
    setTranscript('');
  }, []);

  const stopMeter = React.useCallback(() => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    audioSourceRef.current?.disconnect();
    audioSourceRef.current = null;
    void audioContextRef.current?.close();
    audioContextRef.current = null;

    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    setLevels(createVoiceWaveformLevels());
  }, []);

  const startMeter = React.useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('media-devices-unavailable');
    }

    const AudioContextConstructor = getAudioContextConstructor();

    if (!AudioContextConstructor) {
      throw new Error('audio-context-unavailable');
    }

    stopMeter();

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        autoGainControl: true,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
    const audioContext = new AudioContextConstructor();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();

    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.58;
    const samples = new Uint8Array(analyser.fftSize);

    source.connect(analyser);
    mediaStreamRef.current = stream;
    audioContextRef.current = audioContext;
    audioSourceRef.current = source;

    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    function sampleVoiceLevel() {
      analyser.getByteTimeDomainData(samples);

      let sum = 0;

      for (const sample of samples) {
        const centered = (sample - 128) / 128;
        sum += centered * centered;
      }

      const rms = Math.sqrt(sum / samples.length);
      const level = Math.min(1, Math.max(VOICE_WAVEFORM_MIN_LEVEL, (rms - 0.015) * 8));

      setLevels((current) => [...current.slice(1), level]);
      animationFrameRef.current = window.requestAnimationFrame(sampleVoiceLevel);
    }

    sampleVoiceLevel();
  }, [stopMeter]);

  const stop = React.useCallback(
    (options: { abort?: boolean } = {}) => {
      const recognition = recognitionRef.current;
      const { abort = false } = options;

      stopMeter();

      if (!recognition) {
        setIsActive(false);
        return;
      }

      isStoppingRef.current = true;

      if (abort) {
        recognition.abort();
      } else {
        recognition.stop();
      }

      recognitionRef.current = null;
      setIsActive(false);
    },
    [stopMeter],
  );

  const cancel = React.useCallback(() => {
    const baseInput = baseInputRef.current;

    stop({ abort: true });
    clearTranscript();
    onInputChange(baseInput);
  }, [clearTranscript, onInputChange, stop]);

  const confirm = React.useCallback(() => {
    const nextInput = mergeVoiceTranscript(baseInputRef.current, draftTranscriptRef.current);

    stop();
    clearTranscript();
    onInputChange(nextInput);
  }, [clearTranscript, onInputChange, stop]);

  const toggle = React.useCallback(async () => {
    if (isActive) {
      stop();
      return;
    }

    const SpeechRecognitionConstructor = getSpeechRecognitionConstructor();

    if (!SpeechRecognitionConstructor) {
      toast.error('当前浏览器不支持语音输入，请使用 Chrome 或 Edge。');
      return;
    }

    const recognition = new SpeechRecognitionConstructor();

    baseInputRef.current = input;
    clearTranscript();
    isStoppingRef.current = false;

    try {
      await startMeter();
    } catch {
      clearTranscript();
      toast.error('无法访问麦克风，请允许麦克风权限后再试。');
      return;
    }

    recognition.lang = 'zh-CN';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      setIsActive(true);
      toast.info('正在听，请开始说话。');
    };
    recognition.onresult = (event) => {
      let finalTranscript = finalTranscriptRef.current;
      let interimTranscript = '';

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const nextTranscript = result?.[0]?.transcript ?? '';

        if (!nextTranscript) {
          continue;
        }

        if (result?.isFinal) {
          finalTranscript += nextTranscript;
        } else {
          interimTranscript += nextTranscript;
        }
      }

      const nextTranscript = `${finalTranscript}${interimTranscript}`;

      draftTranscriptRef.current = nextTranscript;
      finalTranscriptRef.current = finalTranscript;
      setTranscript(nextTranscript);
    };
    recognition.onerror = (event) => {
      if (event.error !== 'aborted' && !isStoppingRef.current) {
        toast.error(getVoiceInputErrorMessage(event.error));
        onInputChange(baseInputRef.current);
        clearTranscript();
      }

      recognitionRef.current = null;
      stopMeter();
      setIsActive(false);
    };
    recognition.onend = () => {
      const shouldKeepReview = !isStoppingRef.current && Boolean(draftTranscriptRef.current.trim());

      stopMeter();

      recognitionRef.current = null;
      setIsActive(shouldKeepReview);
      isStoppingRef.current = false;
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      stopMeter();
      setIsActive(false);
      toast.error('语音输入启动失败，请稍后再试。');
    }
  }, [clearTranscript, input, isActive, onInputChange, startMeter, stop, stopMeter]);

  React.useEffect(() => {
    return () => {
      stop({ abort: true });
    };
  }, [stop]);

  return {
    isActive,
    transcript,
    levels,
    toggle,
    cancel,
    confirm,
    stop,
    clearTranscript,
  };
}
