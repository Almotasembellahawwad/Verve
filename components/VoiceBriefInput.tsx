"use client";

import { useRef, useState } from "react";
import styles from "./VoiceBriefInput.module.css";

type SpeechResultEvent = {
  resultIndex: number;
  results: { length: number; [index: number]: { isFinal: boolean; 0: { transcript: string } } };
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

export default function VoiceBriefInput({
  disabled,
  onTranscript,
}: {
  disabled?: boolean;
  onTranscript: (text: string) => void;
}) {
  const [listening, setListening] = useState(false);
  const [language, setLanguage] = useState("ar-EG");
  const [unsupported, setUnsupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const toggle = () => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const browserWindow = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Constructor = browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition;
    if (!Constructor) {
      setUnsupported(true);
      return;
    }

    const recognition = new Constructor();
    recognition.lang = language;
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      let transcript = "";
      for (let index = event.resultIndex; index < event.results.length; index++) {
        if (event.results[index].isFinal) transcript += `${event.results[index][0].transcript} `;
      }
      if (transcript.trim()) onTranscript(transcript.trim());
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setUnsupported(false);
    setListening(true);
  };

  return (
    <div className={styles.voiceRow}>
      <button type="button" className={`${styles.voiceButton} ${listening ? styles.listening : ""}`} onClick={toggle} disabled={disabled} aria-pressed={listening}>
        <span aria-hidden="true">{listening ? "■" : "●"}</span>
        {listening ? "Stop & review" : "Speak your brief"}
      </button>
      <select value={language} onChange={(event) => setLanguage(event.target.value)} disabled={disabled || listening} aria-label="Voice language">
        <option value="ar-EG">العربية</option>
        <option value="en-US">English</option>
      </select>
      <span className={styles.note}>{unsupported ? "Voice recognition is not supported in this browser." : "Transcription stays editable before generation."}</span>
    </div>
  );
}
