'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { CATEGORIES, WARDS, STATUS_CONFIG } from '@/lib/mockData';
import { getBackendBaseUrl } from '@/lib/apiBase';

const STATE_DISTRICT_MAP: Record<string, string[]> = {
  'Andhra Pradesh': ['Anantapur', 'Chittoor', 'East Godavari', 'Guntur', 'Krishna', 'Visakhapatnam'],
  'Bihar': ['Patna', 'Gaya', 'Muzaffarpur', 'Darbhanga', 'Bhagalpur', 'Purnia'],
  'Delhi': ['Central Delhi', 'East Delhi', 'New Delhi', 'North Delhi', 'South Delhi', 'West Delhi'],
  'Gujarat': ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Jamnagar'],
  'Karnataka': ['Bengaluru Urban', 'Mysuru', 'Belagavi', 'Mangaluru', 'Hubballi', 'Ballari'],
  'Madhya Pradesh': ['Bhopal', 'Indore', 'Jabalpur', 'Gwalior', 'Ujjain', 'Sagar'],
  'Maharashtra': ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Thane', 'Aurangabad'],
  'Rajasthan': ['Jaipur', 'Jodhpur', 'Kota', 'Udaipur', 'Ajmer', 'Bikaner'],
  'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Salem', 'Tiruchirappalli', 'Tirunelveli'],
  'Uttar Pradesh': ['Lucknow', 'Kanpur Nagar', 'Varanasi', 'Prayagraj', 'Agra', 'Gorakhpur'],
};

interface SubmittedComplaint {
  id: string;
  ticket_id: string;
  title: string;
  category: string;
  ward: string;
  priority: string;
  effective_priority?: string;
  status: string;
  ai_score: number;
  effective_ai_score?: number;
  urgency_score?: number;
  impact_score?: number;
  recurrence_score?: number;
  sentiment_score?: number;
  ai_explanation?: string;
  ai_model_version?: string;
  score_source?: string;
  ai_breakdown?: {
    recurrence_count?: number;
    local_cluster_count?: number;
    social_mentions?: number;
    qwen_reasoning?: string;
    qwen_fallback_reason?: string;
  };
  input_mode: string;
  created_at: string;
}

interface AuthUser {
  id: number;
  name: string;
  email: string;
  phone?: string;
}

interface TrackedComplaint {
  ticket_id: string;
  title: string;
  priority: string;
  effective_priority?: string;
  category: string;
  ward: string;
  ai_score: number;
  effective_ai_score?: number;
  urgency_score?: number;
  impact_score?: number;
  recurrence_score?: number;
  sentiment_score?: number;
  ai_explanation?: string;
  ai_model_version?: string;
  score_source?: string;
  ai_breakdown?: {
    recurrence_count?: number;
    local_cluster_count?: number;
    social_mentions?: number;
    qwen_reasoning?: string;
    qwen_fallback_reason?: string;
  };
  status: string;
  assigned_authority?: string;
  authority_response?: string;
  citizen_update?: string;
  activity?: { actor_role: string; actor_name?: string; action: string; note?: string; created_at?: string }[];
}

interface MyComplaint {
  ticket_id: string;
  title: string;
  category: string;
  ward: string;
  priority: string;
  effective_priority?: string;
  status: string;
  ai_score?: number;
  effective_ai_score?: number;
  urgency_score?: number;
  impact_score?: number;
  recurrence_score?: number;
  sentiment_score?: number;
  ai_explanation?: string;
  ai_model_version?: string;
  score_source?: string;
  ai_breakdown?: {
    recurrence_count?: number;
    local_cluster_count?: number;
    social_mentions?: number;
    qwen_reasoning?: string;
    qwen_fallback_reason?: string;
  };
  assigned_authority?: string;
  authority_response?: string;
  citizen_update?: string;
  resolved_at?: string;
  created_at?: string;
}

type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

function isTokenExpired(token: string): boolean {
  try {
    const base64Url = token.split('.')[1];
    // JWT uses base64url (- and _ instead of + and /), atob needs standard base64
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    return typeof payload.exp === 'number' && payload.exp * 1000 < Date.now();
  } catch {
    return false; // If we can't decode, let the server decide
  }
}

function safeStorageGet(key: string): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function safeStorageSet(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage write failures in restricted contexts.
  }
}

function safeStorageRemove(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage removal failures in restricted contexts.
  }
}

export default function CitizenPortal() {
  const API_BASE = useMemo(
    () => getBackendBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL),
    [],
  );

  const [tab, setTab] = useState<'file' | 'track'>('file');
  const [contactPhone, setContactPhone] = useState('');
  const [stateName, setStateName] = useState('');
  const [district, setDistrict] = useState('');
  const [category, setCategory] = useState('');
  const [ward, setWard] = useState('');
  const [description, setDescription] = useState('');
  const [inputMode, setInputMode] = useState<'text' | 'voice' | 'photo'>('text');
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceLanguage, setVoiceLanguage] = useState('');
  const [liveSpeechSupported, setLiveSpeechSupported] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceTranscribeError, setVoiceTranscribeError] = useState('');
  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const [voiceFileProcessing, setVoiceFileProcessing] = useState(false);
  const [voiceFileMessage, setVoiceFileMessage] = useState('');
  const [voiceExtractSource, setVoiceExtractSource] = useState('');
  const [voiceExtractModel, setVoiceExtractModel] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoExtractLoading, setPhotoExtractLoading] = useState(false);
  const [photoExtractMessage, setPhotoExtractMessage] = useState('');
  const [photoExtractSource, setPhotoExtractSource] = useState('');
  const [photoExtractModel, setPhotoExtractModel] = useState('');
  const [photoMediaPath, setPhotoMediaPath] = useState('');
  const [voiceMediaPath, setVoiceMediaPath] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [inputProcessing, setInputProcessing] = useState(false);
  const [lastTicket, setLastTicket] = useState('');
  const [complaints, setComplaints] = useState<SubmittedComplaint[]>([]);
  const [trackingId, setTrackingId] = useState('');
  const [trackedResult, setTrackedResult] = useState<TrackedComplaint | null>(null);
  const [myComplaints, setMyComplaints] = useState<MyComplaint[]>([]);
  const [trackError, setTrackError] = useState('');
  const [backendOnline, setBackendOnline] = useState(false);

  // AI Risk Score state (Gemini 2.5 Flash)
  const [riskData, setRiskData] = useState<{
    risk_score: number; risk_level: string; risk_factors: {factor: string; severity: string; description: string}[];
    reasoning: string; urgency_hours: number; ai_model: string; public_safety_impact: string;
    environmental_impact: string; affected_population: string; escalation_risk: string; ai_confidence: number;
  } | null>(null);
  const [riskLoading, setRiskLoading] = useState(false);
  const [geminiImageData, setGeminiImageData] = useState<{
    risk_score: number; risk_level: string; risk_factors: string[]; risk_reasoning: string;
    visible_issues: string[]; recommended_action: string; severity: string;
  } | null>(null);

  const [authMode, setAuthMode] = useState<'signup' | 'login'>('signup');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);

  const availableStates = useMemo(() => Object.keys(STATE_DISTRICT_MAP), []);
  const availableDistricts = useMemo(() => {
    if (!stateName) return [];
    return STATE_DISTRICT_MAP[stateName] || [];
  }, [stateName]);

  const locationWard = useMemo(() => {
    if (ward.trim()) return ward.trim();
    if (district) return `${district} District`;
    return '';
  }, [ward, district]);

  const ensureLocationSelected = () => {
    if (!stateName) {
      alert('Please select a state before continuing.');
      return false;
    }
    if (!district) {
      alert('Please select a district before continuing.');
      return false;
    }
    return true;
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const w = window as Window & {
      webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
      SpeechRecognition?: new () => BrowserSpeechRecognition;
    };
    setLiveSpeechSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const token = safeStorageGet('citizen_token');
    const userRaw = safeStorageGet('citizen_user');
    if (token && userRaw) {
      if (!isTokenExpired(token)) {
        try {
          const parsedUser = JSON.parse(userRaw) as AuthUser;
          setAuthToken(token);
          setAuthUser(parsedUser);
          setContactPhone(parsedUser.phone || '');
        } catch {
          safeStorageRemove('citizen_token');
          safeStorageRemove('citizen_user');
        }
      } else {
        // Token expired — clear storage and show login form
        safeStorageRemove('citizen_token');
        safeStorageRemove('citizen_user');
        setAuthMode('login');
      }
    }
  }, []);

  useEffect(() => {
    if (!authToken) return;

    fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${authToken}`, 'Cache-Control': 'no-cache' },
    })
      .then(async (res) => {
        if (res.status === 401) {
          handleLogout();
          setAuthError('Your session expired. Please log in again to continue.');
          return;
        }
        if (!res.ok) return;
        const user = await res.json();
        setAuthUser(user);
        setContactPhone(user?.phone || '');
      })
      .catch(() => {
        // Network error (backend temporarily down) — do NOT log out
      });
  }, [authToken, API_BASE]);

  useEffect(() => {
    if (!authToken) {
      setMyComplaints([]);
      return;
    }

    fetch(`${API_BASE}/api/complaints/my`, {
      headers: { Authorization: `Bearer ${authToken}`, 'Cache-Control': 'no-cache' },
    })
      .then(async (res) => {
        if (res.status === 401) {
          handleLogout();
          setAuthError('Your session expired. Please log in again to continue.');
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        setMyComplaints(data?.complaints || []);
      })
      .catch(() => {
        // Keep existing UI state on temporary network failures.
      });
  }, [authToken, submitted, API_BASE]);

  // Check backend health + load complaints
  useEffect(() => {
    fetch(`${API_BASE}/api/complaints?limit=20`)
      .then(r => r.json())
      .then((data: { complaints?: Array<Partial<SubmittedComplaint>> }) => {
        setBackendOnline(true);
        if (data.complaints) {
          setComplaints(data.complaints.map((c) => ({
            id: c.ticket_id || '',
            ticket_id: c.ticket_id || '',
            title: c.title || '',
            category: c.category || '',
            ward: c.ward || '',
            priority: c.priority || 'P3',
            effective_priority: c.effective_priority || c.priority || 'P3',
            status: c.status || 'open',
            ai_score: c.ai_score || 0,
            effective_ai_score: c.effective_ai_score || c.ai_score || 0,
            urgency_score: c.urgency_score || 0,
            impact_score: c.impact_score || 0,
            recurrence_score: c.recurrence_score || 0,
            sentiment_score: c.sentiment_score || 0,
            ai_explanation: c.ai_explanation || '',
            ai_model_version: c.ai_model_version || '',
            score_source: c.score_source || 'heuristic_fallback',
            ai_breakdown: c.ai_breakdown || undefined,
            input_mode: c.input_mode || 'text',
            created_at: c.created_at || '',
          })));
        }
      })
      .catch(() => setBackendOnline(false));
  }, [submitted, API_BASE]);

  const persistAuth = (token: string, user: AuthUser) => {
    setAuthToken(token);
    setAuthUser(user);
    setContactPhone(user.phone || '');
    safeStorageSet('citizen_token', token);
    safeStorageSet('citizen_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setAuthToken('');
    setAuthUser(null);
    setMyComplaints([]);
    setTrackedResult(null);
    setAuthMode('login');
    safeStorageRemove('citizen_token');
    safeStorageRemove('citizen_user');
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');

    try {
      const endpoint = authMode === 'signup' ? `${API_BASE}/api/auth/signup` : `${API_BASE}/api/auth/login`;
      const payload = authMode === 'signup'
        ? { name: authName.trim(), email: authEmail.trim(), phone: authPhone.trim() || null, password: authPassword }
        : { email: authEmail.trim(), password: authPassword };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setAuthError(data?.detail || 'Authentication failed');
        return;
      }

      persistAuth(data.token, data.user as AuthUser);
      setAuthName('');
      setAuthEmail('');
      setAuthPhone('');
      setAuthPassword('');
    } catch {
      setAuthError('Cannot connect to backend auth service.');
    } finally {
      setAuthLoading(false);
    }
  };

  const parseErrorMessage = async (res: Response) => {
    try {
      const payload = await res.json();
      return payload?.detail || 'Request failed';
    } catch {
      return 'Request failed';
    }
  };

  const extractProblemFromImageOnly = async () => {
    if (!photoFile) {
      setPhotoExtractMessage('Please upload a photo first.');
      return;
    }
    if (!ensureLocationSelected()) {
      return;
    }

    setPhotoExtractLoading(true);
    setPhotoExtractMessage('');
    setPhotoExtractSource('');
    setPhotoExtractModel('');
    setGeminiImageData(null);

    try {
      const imageData = new FormData();
      imageData.append('image', photoFile);
      imageData.append('ward', locationWard);

      // Use Gemini 2.5 Flash for image analysis
      const res = await fetch(`${API_BASE}/api/complaints/ai/analyze-image`, {
        method: 'POST',
        body: imageData,
      });

      if (!res.ok) {
        setPhotoExtractMessage(`Could not extract description: ${await parseErrorMessage(res)}`);
        return;
      }

      const payload = await res.json();

      if (payload?.source_media_path) {
        setPhotoMediaPath(String(payload.source_media_path));
      }

      if (payload?.success) {
        const desc = String(payload.description || '').trim();
        if (desc) setDescription(desc);
        if (payload.category) setCategory(String(payload.category));
        setPhotoExtractSource('gemini');
        setPhotoExtractModel(payload.ai_model || 'Gemini 2.5 Flash');
        setGeminiImageData({
          risk_score: payload.risk_score || 0,
          risk_level: payload.risk_level || 'Medium',
          risk_factors: payload.risk_factors || [],
          risk_reasoning: payload.risk_reasoning || '',
          visible_issues: payload.visible_issues || [],
          recommended_action: payload.recommended_action || '',
          severity: payload.severity || 'medium',
        });
        setPhotoExtractMessage(
          `✨ Gemini 2.5 Flash analyzed your photo — ${payload.severity?.toUpperCase()} severity, ` +
          `Risk Score: ${Math.round(payload.risk_score || 0)}/100. You can edit the description below.`
        );
      } else {
        // Fallback to old endpoint
        const fallbackRes = await fetch(`${API_BASE}/api/complaints/extract/image-only`, {
          method: 'POST',
          body: imageData,
        });
        if (fallbackRes.ok) {
          const fb = await fallbackRes.json();
          const fbDesc = String(fb?.image_problem_description || fb?.description || '').trim();
          if (fbDesc) setDescription(fbDesc);
          if (fb?.category) setCategory(String(fb.category));
          if (fb?.source_media_path) setPhotoMediaPath(String(fb.source_media_path));
          setPhotoExtractSource('fallback');
          setPhotoExtractModel(fb?.image_description_model || 'Qwen');
          setPhotoExtractMessage('Photo analyzed with fallback AI. You can edit the description below.');
        } else {
          setPhotoExtractMessage('Image analyzed, but description generation failed. Please add details manually.');
        }
      }
    } catch {
      setPhotoExtractMessage('Failed to contact Gemini AI image service.');
    } finally {
      setPhotoExtractLoading(false);
    }
  };

  const extractFromVoiceUpload = async () => {
    if (!voiceFile) {
      setVoiceFileMessage('Please choose an audio file first.');
      return;
    }
    if (!ensureLocationSelected()) {
      return;
    }

    setVoiceFileProcessing(true);
    setVoiceFileMessage('');
    setVoiceExtractSource('');
    setVoiceExtractModel('');

    try {
      const form = new FormData();
      form.append('audio', voiceFile);
      form.append('ward', locationWard);

      const res = await fetch(`${API_BASE}/api/complaints/extract/voice`, {
        method: 'POST',
        body: form,
      });

      if (!res.ok) {
        setVoiceFileMessage(`Could not transcribe voice upload: ${await parseErrorMessage(res)}`);
        return;
      }

      const payload = await res.json();
      const transcript = String(payload?.transcript || payload?.description || '').trim();
      if (transcript) {
        setVoiceTranscript(transcript);
        setVoiceLanguage(payload?.speech?.language || 'Uploaded Audio');
        if (!description.trim()) {
          setDescription(transcript);
        }
      }

      if (payload?.category && !category) {
        setCategory(String(payload.category));
      }

      if (payload?.source_media_path) {
        setVoiceMediaPath(String(payload.source_media_path));
      }

      const source = String(payload?.voice_description_source || payload?.ai?.voice_description_source || payload?.speech?.transcription_source || '').trim();
      const model = String(payload?.voice_description_model || payload?.ai?.voice_description_model || payload?.speech?.transcription_model || '').trim();
      setVoiceExtractSource(source);
      setVoiceExtractModel(model);

      if (source === 'whisper') {
        setVoiceFileMessage('Whisper transcribed your audio. You can edit details before submit.');
      } else {
        setVoiceFileMessage('Audio transcribed using fallback speech pipeline. You can edit details before submit.');
      }
    } catch {
      setVoiceFileMessage('Failed to contact voice extraction service.');
    } finally {
      setVoiceFileProcessing(false);
    }
  };

  const startLiveDictation = async () => {
    if (typeof window === 'undefined') return;
    const w = window as Window & {
      webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
      SpeechRecognition?: new () => BrowserSpeechRecognition;
    };
    const SpeechRecognitionCtor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setVoiceTranscribeError('Live dictation is not supported in this browser. Use Chrome or Edge.');
      return;
    }

    setVoiceTranscribeError('');

    // Explicitly request microphone permission first — this is required on
    // deployed HTTPS sites where the browser may not implicitly grant access.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Release the stream immediately — we only need the permission grant.
      stream.getTracks().forEach(t => t.stop());
    } catch (micErr: unknown) {
      const msg = micErr instanceof Error ? micErr.message : String(micErr);
      setVoiceTranscribeError(
        `Microphone access denied. Please allow microphone permission in your browser settings and try again. (${msg})`
      );
      return;
    }

    const maxRetries = 3;
    let attempt = 0;

    const tryStart = () => {
      attempt += 1;
      const recognition = new SpeechRecognitionCtor();
      recognition.lang = 'en-IN';
      recognition.interimResults = true;
      recognition.continuous = true;

      recognition.onresult = (event) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i += 1) {
          transcript += `${event.results[i][0].transcript} `;
        }
        const normalized = transcript.trim();
        setVoiceTranscript(normalized);
        setVoiceLanguage('Live Mic');
      };

      recognition.onerror = (event) => {
        const err = event?.error || 'unknown';

        // The 'network' error is often transient — retry automatically
        if (err === 'network' && attempt < maxRetries) {
          console.warn(`[SpeechRecognition] network error on attempt ${attempt}/${maxRetries}, retrying...`);
          recognition.abort();
          setTimeout(tryStart, 500);
          return;
        }

        if (err === 'network') {
          setVoiceTranscribeError(
            'Live mic could not connect to speech servers. This can happen on some networks/browsers. ' +
            'Try: 1) Refresh the page 2) Use Chrome or Edge 3) Check that your network allows Google Speech services. ' +
            'Alternatively, use the "Upload Audio" option to transcribe a recorded file.'
          );
        } else if (err === 'not-allowed') {
          setVoiceTranscribeError(
            'Microphone access was denied. Please allow microphone permission in your browser settings (click the lock icon in the address bar).'
          );
        } else {
          setVoiceTranscribeError(`Live transcription error: ${err}`);
        }
        setVoiceListening(false);
        recognitionRef.current = null;
      };

      recognition.onend = () => {
        setVoiceListening(false);
        if (!description.trim() && voiceTranscript.trim()) {
          setDescription(voiceTranscript.trim());
        }
        recognitionRef.current = null;
      };

      recognitionRef.current = recognition;
      recognition.start();
      setVoiceListening(true);
    };

    tryStart();
  };

  const stopLiveDictation = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setVoiceListening(false);
  };

  // Submit complaint to real backend
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Read token fresh from local storage to avoid React stale closure issues.
    const currentToken = authToken || safeStorageGet('citizen_token');
    const currentUser = authUser;

    if (!currentToken || !currentUser) {
      setAuthMode('login');
      setAuthError('Please log in before filing a complaint.');
      return;
    }

    // Catch expired tokens client-side before wasting the network call
    if (isTokenExpired(currentToken)) {
      handleLogout();
      setAuthError('Your session expired. Please log in again to continue.');
      return;
    }

    setSubmitting(true);
    setInputProcessing(true);

    try {
      if (!ensureLocationSelected()) {
        return;
      }

      let finalDescription = description.trim();
      let finalCategory = category;
      let finalImagePath = photoMediaPath;
      let finalAudioPath = voiceMediaPath;

      if (inputMode === 'voice') {
        let transcriptText = voiceTranscript.trim();

        if (voiceFile && (!transcriptText || !finalAudioPath)) {
          const form = new FormData();
          form.append('audio', voiceFile);
          form.append('ward', locationWard);

          const voiceRes = await fetch(`${API_BASE}/api/complaints/extract/voice`, {
            method: 'POST',
            body: form,
          });

          if (!voiceRes.ok) {
            throw new Error(await parseErrorMessage(voiceRes));
          }

          const voiceExtraction = await voiceRes.json();
          transcriptText = String(voiceExtraction?.transcript || voiceExtraction?.description || '').trim();
          if (voiceExtraction?.source_media_path) {
            finalAudioPath = String(voiceExtraction.source_media_path);
            setVoiceMediaPath(finalAudioPath);
          }
          if (!finalCategory && voiceExtraction?.category) {
            finalCategory = String(voiceExtraction.category);
          }
        }

        if (!transcriptText && !finalDescription) {
          alert('Please use live mic dictation, or type details in additional details.');
          return;
        }

        if (!finalDescription) {
          finalDescription = transcriptText;
        } else if (transcriptText && finalDescription !== transcriptText) {
          finalDescription = `${transcriptText}\n\nAdditional details: ${finalDescription}`;
        }
      }

      if (inputMode === 'photo') {
        if (!photoFile) {
          alert('Please upload a photo for photo mode.');
          return;
        }

        if (!finalCategory || !finalDescription) {
          const imageData = new FormData();
          imageData.append('image', photoFile);
          imageData.append('ward', locationWard);

          const detectRes = await fetch(`${API_BASE}/api/complaints/extract/image`, {
            method: 'POST',
            body: imageData,
          });

          if (!detectRes.ok) {
            throw new Error(await parseErrorMessage(detectRes));
          }

          const detection = await detectRes.json();
          if (!finalCategory && detection?.category) {
            finalCategory = String(detection.category);
          }

          if (detection?.source_media_path) {
            finalImagePath = String(detection.source_media_path);
            setPhotoMediaPath(finalImagePath);
          }

          if (!finalDescription) {
            finalDescription = String(
              detection?.image_problem_description
                || detection?.description
                || `Photo report: ${detection?.category || 'infrastructure issue'} detected.`
            ).trim();
          }
        }
      }

      if (!finalDescription) {
        alert('Please provide complaint details before submitting.');
        return;
      }

      if (!finalCategory) {
        alert('Please select a category (or use photo detection to auto-detect).');
        return;
      }

      const res = await fetch(`${API_BASE}/api/complaints`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentToken}`,
        },
        body: JSON.stringify({
          title: finalDescription.slice(0, 80),
          description: finalDescription,
          category: finalCategory,
          ward: locationWard,
          location: `${district}, ${stateName}`,
          citizen_name: currentUser.name,
          citizen_phone: contactPhone || currentUser.phone || null,
          image_path: inputMode === 'photo' ? (finalImagePath || null) : null,
          audio_path: inputMode === 'voice' ? (finalAudioPath || null) : null,
          input_mode: inputMode,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setLastTicket(data.ticket_id);
        setSubmitted(true);

        // Trigger Gemini AI Risk Assessment
        setRiskLoading(true);
        setRiskData(null);
        try {
          const riskRes = await fetch(`${API_BASE}/api/complaints/ai/risk-assessment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              description: finalDescription,
              category: finalCategory,
              ward: locationWard,
              title: finalDescription.slice(0, 80),
            }),
          });
          if (riskRes.ok) {
            const risk = await riskRes.json();
            if (risk?.success) setRiskData(risk);
          }
        } catch { /* risk assessment is non-blocking */ }
        setRiskLoading(false);

        setDescription('');
        setCategory('');
        setStateName('');
        setDistrict('');
        setWard('');
        setVoiceTranscript('');
        setVoiceLanguage('');
        setVoiceListening(false);
        setVoiceTranscribeError('');
        setVoiceFile(null);
        setVoiceFileMessage('');
        setVoiceExtractSource('');
        setVoiceExtractModel('');
        setVoiceMediaPath('');
        setPhotoFile(null);
        setPhotoMediaPath('');
        setPhotoExtractMessage('');
        setPhotoExtractSource('');
        setPhotoExtractModel('');
        setGeminiImageData(null);
      } else {
        const detail = await parseErrorMessage(res);
        if (res.status === 401) {
          handleLogout();
          setAuthError('Your session expired. Please log in again to continue.');
        } else {
          alert(`Failed to submit complaint: ${detail}`);
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const browserOrigin = typeof window !== 'undefined' ? window.location.origin : 'unknown';
      const apiHint = `${API_BASE}/health`;
      alert(
        `Cannot process complaint: ${message}\n\n` +
        `Likely causes:\n` +
        `1) Backend URL not reachable from browser\n` +
        `2) CORS origin not allowed\n` +
        `3) HTTPS/HTTP mismatch between frontend and backend\n\n` +
        `Frontend origin: ${browserOrigin}\n` +
        `Backend base: ${API_BASE}\n` +
        `Quick check: open ${apiHint}`
      );
    } finally {
      setInputProcessing(false);
      setSubmitting(false);
    }
  };

  // Track complaint from backend
  const handleTrack = async () => {
    if (!trackingId) return;
    setTrackError('');
    setTrackedResult(null);

    try {
      const res = await fetch(`${API_BASE}/api/complaints/${trackingId.trim().toUpperCase()}`);
      if (res.ok) {
        const data = await res.json();
        setTrackedResult(data);
      } else {
        setTrackError('Ticket not found. Check the ID and try again.');
      }
    } catch {
      setTrackError('Cannot connect to backend.');
    }
  };

  return (
    <main className="main-content">
      <section className="section" style={{ paddingTop: 80 }}>
        <div className="container">
          <div className="section-label">CITIZEN PORTAL</div>
          <h1 className="section-title">Your Voice Matters</h1>
          <p className="section-subtitle" style={{ marginBottom: 16 }}>
            Report issues, track progress, and rate the resolution — all in one place
          </p>

          {/* Backend Status */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '6px 16px', borderRadius: 20, marginBottom: 24,
            background: backendOnline ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${backendOnline ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
            fontSize: '0.8rem', fontWeight: 600,
            color: backendOnline ? '#16a34a' : '#dc2626',
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: backendOnline ? '#22c55e' : '#ef4444' }} />
            {backendOnline ? 'AI Backend Connected' : 'Backend Offline — Start with: uvicorn main:app --port 8010'}
          </div>

          {/* Tab Switcher */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
            <button onClick={() => setTab('file')} className="glass-card" style={{
              flex: 1, cursor: 'pointer', textAlign: 'center', padding: '16px',
              border: tab === 'file' ? '1px solid var(--accent-blue)' : '1px solid var(--border-subtle)',
              background: tab === 'file' ? 'rgba(59,130,246,0.1)' : 'var(--bg-glass)',
            }}>
              <div style={{ fontSize: '1.5rem', marginBottom: 4 }}></div>
              <div style={{ fontWeight: 700 }}>File Complaint</div>
            </button>
            <button onClick={() => setTab('track')} className="glass-card" style={{
              flex: 1, cursor: 'pointer', textAlign: 'center', padding: '16px',
              border: tab === 'track' ? '1px solid var(--accent-blue)' : '1px solid var(--border-subtle)',
              background: tab === 'track' ? 'rgba(59,130,246,0.1)' : 'var(--bg-glass)',
            }}>
              <div style={{ fontSize: '1.5rem', marginBottom: 4 }}></div>
              <div style={{ fontWeight: 700 }}>Track Complaint</div>
            </button>
          </div>

          {tab === 'file' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
              <div className="glass-card" style={{ padding: 32 }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 24 }}>Submit Your Complaint</h3>

                {!authToken || !authUser ? (
                  <>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                      <button
                        onClick={() => setAuthMode('signup')}
                        style={{
                          flex: 1,
                          padding: '10px',
                          borderRadius: 8,
                          cursor: 'pointer',
                          border: 'none',
                          background: authMode === 'signup' ? 'rgba(59,130,246,0.15)' : 'var(--bg-tertiary)',
                          color: authMode === 'signup' ? 'var(--accent-blue-light)' : 'var(--text-secondary)',
                          fontWeight: 600,
                        }}
                      >
                        Create Account
                      </button>
                      <button
                        onClick={() => setAuthMode('login')}
                        style={{
                          flex: 1,
                          padding: '10px',
                          borderRadius: 8,
                          cursor: 'pointer',
                          border: 'none',
                          background: authMode === 'login' ? 'rgba(59,130,246,0.15)' : 'var(--bg-tertiary)',
                          color: authMode === 'login' ? 'var(--accent-blue-light)' : 'var(--text-secondary)',
                          fontWeight: 600,
                        }}
                      >
                        Login
                      </button>
                    </div>

                    <form onSubmit={handleAuthSubmit}>
                      {authMode === 'signup' && (
                        <div className="form-group">
                          <label className="form-label">Full Name</label>
                          <input className="form-input" value={authName} onChange={e => setAuthName(e.target.value)} placeholder="Enter your name" required />
                        </div>
                      )}
                      <div className="form-group">
                        <label className="form-label">Email</label>
                        <input type="email" className="form-input" value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="you@example.com" required />
                      </div>
                      {authMode === 'signup' && (
                        <div className="form-group">
                          <label className="form-label">Phone Number (Optional)</label>
                          <input className="form-input" value={authPhone} onChange={e => setAuthPhone(e.target.value)} placeholder="+91 XXXXX XXXXX" />
                        </div>
                      )}
                      <div className="form-group">
                        <label className="form-label">Password</label>
                        <input type="password" className="form-input" value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="Enter password" required minLength={6} />
                      </div>

                      <button type="submit" className="btn btn-primary" disabled={authLoading} style={{ width: '100%', justifyContent: 'center' }}>
                        {authLoading ? '⏳ Authenticating...' : authMode === 'signup' ? ' Sign Up & Continue' : ' Login'}
                      </button>
                    </form>

                    {authError && <div style={{ marginTop: 12, color: '#dc2626', fontSize: '0.85rem' }}> {authError}</div>}
                    <div style={{ marginTop: 12, fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                      Complaint filing is allowed only for authenticated citizens.
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 16,
                      padding: '10px 12px',
                      borderRadius: 8,
                      background: 'rgba(34,197,94,0.08)',
                      border: '1px solid rgba(34,197,94,0.25)',
                    }}>
                      <div style={{ fontSize: '0.82rem' }}>
                        Filing as <strong>{authUser.name}</strong> ({authUser.email})
                      </div>
                      <button className="btn btn-secondary" onClick={handleLogout} style={{ padding: '6px 12px' }}>
                        Logout
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
                      {([
                        { key: 'text' as const, icon: '', label: 'Text' },
                        { key: 'voice' as const, icon: '', label: 'Voice' },
                        { key: 'photo' as const, icon: '', label: 'Photo' },
                      ]).map(mode => (
                        <button
                          key={mode.key}
                          onClick={() => {
                            setInputMode(mode.key);
                            setVoiceTranscript('');
                            setVoiceLanguage('');
                            setVoiceListening(false);
                            setVoiceTranscribeError('');
                            setVoiceFile(null);
                            setVoiceFileMessage('');
                            setVoiceExtractSource('');
                            setVoiceExtractModel('');
                            setVoiceMediaPath('');
                            setPhotoFile(null);
                            setPhotoMediaPath('');
                            setPhotoExtractMessage('');
                            setPhotoExtractSource('');
                            setPhotoExtractModel('');
                          }}
                          style={{
                            flex: 1,
                            padding: '10px',
                            borderRadius: 8,
                            cursor: 'pointer',
                            border: 'none',
                            background: inputMode === mode.key ? 'rgba(59,130,246,0.15)' : 'var(--bg-tertiary)',
                            color: inputMode === mode.key ? 'var(--accent-blue-light)' : 'var(--text-secondary)',
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            fontFamily: 'Inter, sans-serif',
                          }}
                        >
                          {mode.icon} {mode.label}
                        </button>
                      ))}
                    </div>

                    <form onSubmit={handleSubmit}>
                      <div className="form-group">
                        <label className="form-label">Contact Phone (Optional)</label>
                        <input className="form-input" value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="+91 XXXXX XXXXX" />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div className="form-group">
                          <label className="form-label">State</label>
                          <select
                            className="form-select"
                            value={stateName}
                            onChange={e => {
                              setStateName(e.target.value);
                              setDistrict('');
                            }}
                            required
                          >
                            <option value="">Select state</option>
                            {availableStates.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">District</label>
                          <select
                            className="form-select"
                            value={district}
                            onChange={e => setDistrict(e.target.value)}
                            required
                            disabled={!stateName}
                          >
                            <option value="">{stateName ? 'Select district' : 'Select state first'}</option>
                            {availableDistricts.map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div className="form-group">
                          <label className="form-label">Category</label>
                          <select className="form-select" value={category} onChange={e => setCategory(e.target.value)}>
                            <option value="">Select category</option>
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Ward (Optional)</label>
                          <select className="form-select" value={ward} onChange={e => setWard(e.target.value)}>
                            <option value="">Use district as location</option>
                            {WARDS.map(w => <option key={w} value={w}>{w}</option>)}
                          </select>
                        </div>
                      </div>

                      {inputMode === 'voice' && (
                        <div className="form-group">
                          <label className="form-label">Live Voice Input</label>
                          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              disabled={!liveSpeechSupported || inputProcessing || submitting}
                              onClick={() => {
                                if (voiceListening) {
                                  stopLiveDictation();
                                } else {
                                  startLiveDictation();
                                }
                              }}
                            >
                              {voiceListening ? '⏹️ Stop Live Mic' : '️ Start Live Mic'}
                            </button>

                            <button
                              type="button"
                              className="btn btn-secondary"
                              disabled={!voiceTranscript}
                              onClick={() => {
                                if (!description.trim()) {
                                  setDescription(voiceTranscript);
                                }
                              }}
                            >
                              Use Transcript
                            </button>
                          </div>

                          {!liveSpeechSupported && (
                            <div style={{ marginTop: 8, fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                              Live microphone dictation is unavailable in this browser. Use Chrome/Edge for this feature.
                            </div>
                          )}

                          {voiceTranscribeError && (
                            <div style={{ marginTop: 8, color: '#dc2626', fontSize: '0.78rem' }}>
                               {voiceTranscribeError}
                            </div>
                          )}

                          {voiceTranscript && (
                            <div style={{ marginTop: 10 }}>
                              <div style={{ fontSize: '0.76rem', color: 'var(--text-tertiary)', marginBottom: 4 }}>
                                Transcript {voiceLanguage ? `(${voiceLanguage})` : ''}
                              </div>
                              <div style={{
                                background: 'var(--bg-tertiary)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: 8,
                                padding: 10,
                                fontSize: '0.82rem',
                                color: 'var(--text-secondary)',
                                whiteSpace: 'pre-wrap',
                              }}>
                                {voiceTranscript}
                              </div>
                            </div>
                          )}

                          <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 4 }}>
                            Use Start Live Mic to dictate your complaint, then Stop and submit.
                          </div>

                          <div style={{ marginTop: 12, borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}>
                            <label className="form-label">Or Upload Voice File</label>
                            <input
                              type="file"
                              accept="audio/*"
                              onChange={e => {
                                setVoiceFile(e.target.files?.[0] || null);
                                setVoiceFileMessage('');
                              }}
                              style={{ width: '100%' }}
                            />
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={extractFromVoiceUpload}
                              disabled={!voiceFile || voiceFileProcessing || submitting || inputProcessing}
                              style={{ marginTop: 10 }}
                            >
                              {voiceFileProcessing ? '⏳ Transcribing with Whisper STT...' : ' Extract with Whisper STT'}
                            </button>
                            {voiceFileMessage && (
                              <div style={{ marginTop: 8, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                {voiceFileMessage}
                              </div>
                            )}
                            {voiceExtractSource && (
                              <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                <span className="chip" style={{ fontSize: '0.68rem' }}>
                                  Voice Engine: {voiceExtractSource === 'whisper' ? 'Whisper STT' : 'Speech Fallback'}
                                </span>
                                {voiceExtractModel && (
                                  <span className="chip" style={{ fontSize: '0.68rem' }}>
                                    Model: {voiceExtractModel}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {inputMode === 'photo' && (
                        <div className="form-group">
                          <label className="form-label">Upload Issue Photo</label>
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={e => setPhotoFile(e.target.files?.[0] || null)}
                            required
                            style={{ width: '100%' }}
                          />
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 4 }}>
                            {photoFile ? `Selected: ${photoFile.name}` : 'Photo detection will suggest category and severity automatically.'}
                          </div>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={extractProblemFromImageOnly}
                            disabled={!photoFile || photoExtractLoading || submitting || inputProcessing}
                            style={{ marginTop: 10 }}
                          >
                            {photoExtractLoading ? '⏳ Gemini 2.5 Flash analyzing...' : '✨ Analyze with Gemini 2.5 Flash'}
                          </button>
                          {photoExtractMessage && (
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 8 }}>
                              {photoExtractMessage}
                            </div>
                          )}
                          {photoExtractSource && (
                            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                              <span className="chip" style={{ fontSize: '0.68rem', background: photoExtractSource === 'gemini' ? 'rgba(59,130,246,0.15)' : undefined, color: photoExtractSource === 'gemini' ? '#60a5fa' : undefined }}>
                                ✨ {photoExtractSource === 'gemini' ? 'Gemini 2.5 Flash' : 'Fallback AI'}
                              </span>
                              {photoExtractModel && (
                                <span className="chip" style={{ fontSize: '0.68rem' }}>
                                  Model: {photoExtractModel}
                                </span>
                              )}
                              {geminiImageData && (
                                <span className="chip" style={{ fontSize: '0.68rem', background: geminiImageData.risk_level === 'Critical' ? 'rgba(239,68,68,0.15)' : geminiImageData.risk_level === 'High' ? 'rgba(249,115,22,0.15)' : geminiImageData.risk_level === 'Medium' ? 'rgba(234,179,8,0.15)' : 'rgba(34,197,94,0.15)', color: geminiImageData.risk_level === 'Critical' ? '#ef4444' : geminiImageData.risk_level === 'High' ? '#f97316' : geminiImageData.risk_level === 'Medium' ? '#eab308' : '#22c55e' }}>
                                  Risk: {geminiImageData.risk_level} ({Math.round(geminiImageData.risk_score)}/100)
                                </span>
                              )}
                            </div>
                          )}
                          {geminiImageData && geminiImageData.visible_issues && geminiImageData.visible_issues.length > 0 && (
                            <div style={{ marginTop: 8, padding: 10, borderRadius: 8, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}>
                              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-blue-light)', marginBottom: 4 }}>🔍 AI DETECTED ISSUES</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {geminiImageData.visible_issues.map((issue, idx) => (
                                  <span key={idx} style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: 12, background: 'rgba(59,130,246,0.1)', color: 'var(--text-secondary)' }}>{issue}</span>
                                ))}
                              </div>
                              {geminiImageData.risk_reasoning && (
                                <div style={{ marginTop: 6, fontSize: '0.74rem', color: 'var(--text-tertiary)' }}>💡 {geminiImageData.risk_reasoning}</div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="form-group">
                        <label className="form-label">
                          {inputMode === 'text'
                            ? 'Describe the Issue'
                            : inputMode === 'photo'
                              ? 'Problem Description (Auto-generated from image, editable)'
                              : 'Additional Details (Optional)'}
                        </label>
                        <textarea
                          className="form-textarea"
                          value={description}
                          onChange={e => setDescription(e.target.value)}
                          placeholder={inputMode === 'text'
                            ? 'Describe the problem in detail...'
                            : inputMode === 'photo'
                              ? 'Click "Extract Problem Description from Photo" to auto-fill this.'
                              : 'Add landmarks, timings, or extra context...'}
                          required={inputMode === 'text'}
                        />
                      </div>

                      <button type="submit" className="btn btn-primary" disabled={submitting || inputProcessing} style={{
                        width: '100%', justifyContent: 'center', marginTop: 8,
                        opacity: submitting || inputProcessing ? 0.7 : 1,
                      }}>
                        {submitting || inputProcessing ? '⏳ Processing AI + Filing...' : ' Submit Complaint'}
                      </button>
                    </form>

                    {submitted && (
                      <div style={{
                        marginTop: 16, borderRadius: 14,
                        background: 'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(139,92,246,0.08) 100%)',
                        border: '1px solid rgba(59,130,246,0.25)',
                        animation: 'fadeInUp 0.5s ease',
                        overflow: 'hidden',
                      }}>
                        {/* Header */}
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(59,130,246,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: 700, color: '#22c55e', fontSize: '1rem' }}>✅ Complaint Filed & AI Processed!</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                              Ticket: <strong style={{ color: 'var(--accent-blue-light)' }}>{lastTicket}</strong>
                            </div>
                          </div>
                          <div style={{ fontSize: '0.68rem', padding: '4px 10px', borderRadius: 20, background: 'rgba(59,130,246,0.12)', color: '#60a5fa', fontWeight: 600 }}>
                            ✨ Powered by Gemini 2.5 Flash
                          </div>
                        </div>

                        {/* Risk Score Card */}
                        {riskLoading && (
                          <div style={{ padding: 20, textAlign: 'center' }}>
                            <div style={{ fontSize: '1.2rem', marginBottom: 8, animation: 'pulse 1.5s infinite' }}>🧠</div>
                            <div style={{ fontSize: '0.82rem', color: 'var(--accent-blue-light)' }}>Gemini 2.5 Flash is assessing risk...</div>
                          </div>
                        )}
                        {riskData && (
                          <div style={{ padding: '16px 20px' }}>
                            <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 16 }}>
                              {/* Gauge */}
                              <div style={{ position: 'relative', width: 90, height: 90, minWidth: 90 }}>
                                <svg viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)', width: 90, height: 90 }}>
                                  <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
                                  <circle cx="50" cy="50" r="42" fill="none"
                                    stroke={riskData.risk_level === 'Critical' ? '#ef4444' : riskData.risk_level === 'High' ? '#f97316' : riskData.risk_level === 'Medium' ? '#eab308' : '#22c55e'}
                                    strokeWidth="8" strokeLinecap="round"
                                    strokeDasharray={`${(riskData.risk_score / 100) * 264} 264`}
                                    style={{ transition: 'stroke-dasharray 1.5s ease' }}
                                  />
                                </svg>
                                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: riskData.risk_level === 'Critical' ? '#ef4444' : riskData.risk_level === 'High' ? '#f97316' : riskData.risk_level === 'Medium' ? '#eab308' : '#22c55e' }}>
                                    {Math.round(riskData.risk_score)}
                                  </div>
                                  <div style={{ fontSize: '0.55rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>RISK</div>
                                </div>
                              </div>

                              {/* Details */}
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                                  <span style={{
                                    padding: '3px 10px', borderRadius: 20, fontWeight: 700, fontSize: '0.78rem',
                                    background: riskData.risk_level === 'Critical' ? 'rgba(239,68,68,0.15)' : riskData.risk_level === 'High' ? 'rgba(249,115,22,0.15)' : riskData.risk_level === 'Medium' ? 'rgba(234,179,8,0.15)' : 'rgba(34,197,94,0.15)',
                                    color: riskData.risk_level === 'Critical' ? '#ef4444' : riskData.risk_level === 'High' ? '#f97316' : riskData.risk_level === 'Medium' ? '#eab308' : '#22c55e',
                                  }}>
                                    {riskData.risk_level === 'Critical' ? '🔴' : riskData.risk_level === 'High' ? '🟠' : riskData.risk_level === 'Medium' ? '🟡' : '🟢'} {riskData.risk_level} Risk
                                  </span>
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>⏱ Respond within {Math.round(riskData.urgency_hours || 24)}h</span>
                                </div>
                                {riskData.public_safety_impact && (
                                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 4 }}>🛡️ {riskData.public_safety_impact}</div>
                                )}
                                {riskData.affected_population && (
                                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>👥 Affected: {riskData.affected_population}</div>
                                )}
                              </div>
                            </div>

                            {/* Risk Factors */}
                            {riskData.risk_factors && riskData.risk_factors.length > 0 && (
                              <div style={{ marginBottom: 12 }}>
                                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-blue-light)', marginBottom: 6, letterSpacing: 0.5 }}>⚠️ RISK FACTORS</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                  {riskData.risk_factors.map((f, i) => (
                                    <div key={i} style={{
                                      padding: '4px 10px', borderRadius: 8, fontSize: '0.74rem',
                                      background: f.severity === 'high' ? 'rgba(239,68,68,0.1)' : f.severity === 'medium' ? 'rgba(234,179,8,0.1)' : 'rgba(34,197,94,0.1)',
                                      color: f.severity === 'high' ? '#ef4444' : f.severity === 'medium' ? '#eab308' : '#22c55e',
                                      border: `1px solid ${f.severity === 'high' ? 'rgba(239,68,68,0.2)' : f.severity === 'medium' ? 'rgba(234,179,8,0.2)' : 'rgba(34,197,94,0.2)'}`,
                                    }}>
                                      {f.factor}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* AI Reasoning */}
                            {riskData.reasoning && (
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)' }}>
                                💡 <strong>AI Reasoning:</strong> {riskData.reasoning}
                              </div>
                            )}

                            {riskData.escalation_risk && (
                              <div style={{ marginTop: 8, fontSize: '0.74rem', color: '#f97316', fontWeight: 600 }}>
                                ⚡ If not addressed: {riskData.escalation_risk}
                              </div>
                            )}

                            <div style={{ marginTop: 10, fontSize: '0.68rem', color: 'var(--text-tertiary)', textAlign: 'right' }}>
                              AI Confidence: {Math.round((riskData.ai_confidence || 0.7) * 100)}%  •  {riskData.ai_model}
                            </div>
                          </div>
                        )}
                        {!riskLoading && !riskData && (
                          <div style={{ padding: '12px 20px', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                            AI auto-classified, priority-scored, and sentiments analyzed.
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Right Panel */}
              <div>
                <div className="glass-card" style={{ padding: 24, marginBottom: 16 }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>How It Works</h3>
                  {[
                    { step: 1, title: 'Submit', desc: 'Voice, text, or photo — your choice' },
                    { step: 2, title: 'AI Processes', desc: 'Auto-classified and prioritized in seconds' },
                    { step: 3, title: 'Leader Sees', desc: 'Appears on ward officer\'s dashboard' },
                    { step: 4, title: 'Crew Dispatched', desc: 'Nearest team with GPS directions' },
                    { step: 5, title: 'Verified & Closed', desc: 'GPS photo proof + your SMS confirmation' },
                  ].map(s => (
                    <div key={s.step} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
                      <div style={{
                        width: 32, height: 32, minWidth: 32, borderRadius: '50%',
                        background: 'var(--gradient-blue)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.8rem', fontWeight: 800,
                      }}>{s.step}</div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{s.title}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{s.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="glass-card" style={{ padding: 24 }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 12 }}> Multiple Ways to Report</h3>
                  {['WhatsApp: +14155238886', 'Web Portal: janshakti-ai.tech'].map(ch => (
                    <div key={ch} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{ch}</div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'track' && (
            <div style={{ maxWidth: 700, margin: '0 auto' }}>
              <div className="glass-card" style={{ padding: 32, marginBottom: 24 }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}> Track Your Complaint</h3>
                <div style={{ display: 'flex', gap: 12 }}>
                  <input className="form-input" value={trackingId} onChange={e => setTrackingId(e.target.value)}
                    placeholder="Enter Ticket ID (e.g., TKT-A1B2C3)" onKeyDown={e => e.key === 'Enter' && handleTrack()} />
                  <button className="btn btn-primary" onClick={handleTrack}>Search</button>
                </div>

                {trackError && (
                  <div style={{ marginTop: 12, color: '#dc2626', fontSize: '0.85rem' }}> {trackError}</div>
                )}

                {trackedResult && (
                  <div style={{ marginTop: 24, animation: 'fadeInUp 0.3s ease' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--accent-blue-light)', fontWeight: 600 }}>{trackedResult.ticket_id}</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{trackedResult.title}</div>
                      </div>
                      <span className={`badge badge-${(trackedResult.effective_priority || trackedResult.priority)?.toLowerCase()}`}>{trackedResult.effective_priority || trackedResult.priority}</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                      <div style={{ background: 'var(--bg-tertiary)', borderRadius: 8, padding: 12 }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Category</div>
                        <div style={{ fontWeight: 600 }}>{trackedResult.category}</div>
                      </div>
                      <div style={{ background: 'var(--bg-tertiary)', borderRadius: 8, padding: 12 }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Ward</div>
                        <div style={{ fontWeight: 600 }}>{trackedResult.ward}</div>
                      </div>
                      <div style={{ background: 'var(--bg-tertiary)', borderRadius: 8, padding: 12 }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>AI Score</div>
                        <div style={{ fontWeight: 600, color: 'var(--accent-blue-light)' }}>{Math.round(trackedResult.effective_ai_score || trackedResult.ai_score)}/100</div>
                      </div>
                      <div style={{ background: 'var(--bg-tertiary)', borderRadius: 8, padding: 12 }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Status</div>
                        <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>{trackedResult.status?.replace('_', ' ')}</div>
                      </div>
                    </div>

                    {/* Gemini AI Risk Score Card (if available) */}
                    {(() => {
                      const tr = trackedResult as unknown as { ai_risk_score?: number; ai_risk_level?: string; ai_risk_reasoning?: string };
                      if (tr?.ai_risk_score == null) return null;
                      const rLevel = tr.ai_risk_level || 'Medium';
                      const rScore = Math.round(tr.ai_risk_score || 0);
                      const bgColor = rLevel === 'Critical' ? 'rgba(239,68,68,0.15)' : rLevel === 'High' ? 'rgba(249,115,22,0.15)' : rLevel === 'Medium' ? 'rgba(234,179,8,0.15)' : 'rgba(34,197,94,0.15)';
                      const fgColor = rLevel === 'Critical' ? '#ef4444' : rLevel === 'High' ? '#f97316' : rLevel === 'Medium' ? '#eab308' : '#22c55e';
                      return (
                        <div style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(139,92,246,0.08) 100%)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--accent-blue-light)' }}>🧠 GEMINI AI RISK ASSESSMENT</div>
                            <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: 12, background: 'rgba(59,130,246,0.12)', color: '#60a5fa' }}>✨ Gemini 2.5 Flash</span>
                          </div>
                          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10 }}>
                            <div style={{ width: 52, height: 52, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bgColor, fontSize: '1.1rem', fontWeight: 800, color: fgColor }}>
                              {rScore}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{rLevel} Risk</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>AI Risk Score: {rScore}/100</div>
                            </div>
                          </div>
                          {tr.ai_risk_reasoning && (
                            <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginBottom: 8 }}>💡 {tr.ai_risk_reasoning}</div>
                          )}
                        </div>
                      );
                    })()}

                    <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10, padding: 12, marginBottom: 16 }}>
                      <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--accent-blue-light)', marginBottom: 8 }}>AI TRIAGE BREAKDOWN</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                        <span className="chip" style={{ fontSize: '0.68rem' }}>
                          Engine: {trackedResult.score_source === 'qwen' ? 'Qwen LLM' : 'Heuristic Fallback'}
                        </span>
                        {trackedResult.ai_model_version && (
                          <span className="chip" style={{ fontSize: '0.68rem' }}>Model: {trackedResult.ai_model_version}</span>
                        )}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginBottom: 8 }}>
                        <div><strong>Urgency:</strong> {Math.round(trackedResult.urgency_score || 0)}</div>
                        <div><strong>Impact:</strong> {Math.round(trackedResult.impact_score || 0)}</div>
                        <div><strong>Recurrence:</strong> {Math.round(trackedResult.recurrence_score || 0)}</div>
                        <div><strong>Sentiment:</strong> {Math.round(trackedResult.sentiment_score || 0)}</div>
                      </div>
                      {(trackedResult.ai_breakdown?.recurrence_count || trackedResult.ai_breakdown?.local_cluster_count) ? (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
                          Repeat reports: {trackedResult.ai_breakdown?.recurrence_count || 0} • Nearby similar issues: {trackedResult.ai_breakdown?.local_cluster_count || 0}
                        </div>
                      ) : null}
                      {trackedResult.ai_explanation && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{trackedResult.ai_explanation}</div>
                      )}
                      {trackedResult.ai_breakdown?.qwen_reasoning && (
                        <div style={{ marginTop: 6, fontSize: '0.78rem', color: '#0f766e' }}>
                          Qwen reasoning: {trackedResult.ai_breakdown.qwen_reasoning}
                        </div>
                      )}
                    </div>

                    {/* Status Timeline */}
                    <div style={{ display: 'flex', gap: 0, marginBottom: 24 }}>
                      {Object.entries(STATUS_CONFIG).map(([key, config], i) => {
                        const statuses = Object.keys(STATUS_CONFIG);
                        const currentIdx = statuses.indexOf(trackedResult.status);
                        const isComplete = i <= currentIdx;
                        const isActive = i === currentIdx;
                        return (
                          <div key={key} style={{ flex: 1, textAlign: 'center', position: 'relative' }}>
                            {i > 0 && (
                              <div style={{
                                position: 'absolute', top: 16, left: -10, right: '50%', height: 3,
                                background: isComplete ? config.color : 'var(--bg-tertiary)', zIndex: 0,
                              }} />
                            )}
                            <div style={{
                              width: 32, height: 32, borderRadius: '50%', margin: '0 auto 8px',
                              background: isComplete ? config.color : 'var(--bg-tertiary)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '0.8rem', position: 'relative', zIndex: 1,
                              boxShadow: isActive ? `0 0 16px ${config.color}44` : 'none',
                              color: isComplete ? 'white' : 'var(--text-tertiary)',
                            }}>
                              {isComplete ? '' : (i + 1)}
                            </div>
                            <div style={{ fontSize: '0.7rem', fontWeight: 600, color: isComplete ? config.color : 'var(--text-tertiary)' }}>{config.label}</div>
                          </div>
                        );
                      })}
                    </div>

                    {(trackedResult.citizen_update || trackedResult.authority_response) && (
                      <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
                        {trackedResult.citizen_update && (
                          <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: 12 }}>
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-blue-light)', marginBottom: 4 }}>PROFILE UPDATE</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{trackedResult.citizen_update}</div>
                          </div>
                        )}

                        {trackedResult.authority_response && (
                          <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, padding: 12 }}>
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#16a34a', marginBottom: 4 }}>AUTHORITY RESPONSE</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{trackedResult.authority_response}</div>
                          </div>
                        )}
                      </div>
                    )}

                    {trackedResult.activity && trackedResult.activity.length > 0 && (
                      <div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 1, marginBottom: 8 }}>WORKFLOW TIMELINE</div>
                        {trackedResult.activity.slice(-5).reverse().map((a, idx) => (
                          <div key={`${a.action}-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                            <div>
                              <div style={{ fontSize: '0.83rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                {a.action.replaceAll('_', ' ')}
                              </div>
                              {a.note && <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{a.note}</div>}
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>{a.actor_role}</div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>{a.created_at ? new Date(a.created_at).toLocaleString('en-IN') : ''}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {authUser && (
                <div className="glass-card" style={{ padding: 24, marginBottom: 24 }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 14 }}>
                     My Profile Updates
                  </h3>

                  {myComplaints.length === 0 ? (
                    <div style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
                      No complaints in your profile yet. File a complaint to start tracking updates.
                    </div>
                  ) : (
                    myComplaints.slice(0, 8).map((c) => {
                      const sConfig = STATUS_CONFIG[c.status as keyof typeof STATUS_CONFIG];
                      const solved = c.status === 'resolved';
                      return (
                        <div key={c.ticket_id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                            <div>
                              <div style={{ fontSize: '0.78rem', color: 'var(--accent-blue-light)', fontWeight: 600 }}>{c.ticket_id}</div>
                              <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{c.title}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{c.category} · {c.ward}</div>
                              {typeof c.effective_ai_score === 'number' && (
                                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                                  AI {Math.round(c.effective_ai_score)}/100 • {c.effective_priority || c.priority} • {c.score_source === 'qwen' ? 'Qwen' : 'Fallback'}
                                </div>
                              )}
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '0.78rem', color: solved ? '#16a34a' : (sConfig?.color || '#64748b'), fontWeight: 700 }}>
                                {solved ? 'Solved ' : (sConfig?.label || c.status)}
                              </div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                                {c.resolved_at ? `Resolved ${new Date(c.resolved_at).toLocaleDateString('en-IN')}` : (c.created_at ? `Filed ${new Date(c.created_at).toLocaleDateString('en-IN')}` : '')}
                              </div>
                            </div>
                          </div>

                          {(c.citizen_update || c.assigned_authority) && (
                            <div style={{ marginTop: 8, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                              {c.citizen_update || `Assigned to ${c.assigned_authority}`}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Recent Complaints from Backend */}
              <div className="glass-card" style={{ padding: 24 }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>
                  Recent Complaints {complaints.length > 0 && <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>({complaints.length})</span>}
                </h3>
                {complaints.length === 0 && (
                  <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-tertiary)' }}>
                    No complaints yet. File one above!
                  </div>
                )}
                {complaints.map(c => {
                  const sConfig = STATUS_CONFIG[c.status as keyof typeof STATUS_CONFIG];
                  return (
                    <div key={c.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '12px 0', borderBottom: '1px solid var(--border-subtle)',
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--accent-blue-light)', fontWeight: 600 }}>{c.id || c.ticket_id}</span>
                          <span className={`badge badge-${c.priority?.toLowerCase()}`} style={{ fontSize: '0.65rem', padding: '2px 6px' }}>{c.priority}</span>
                          {c.ai_score > 0 && <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>AI: {c.ai_score}</span>}
                          {typeof c.effective_ai_score === 'number' && <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>Effective: {Math.round(c.effective_ai_score)}</span>}
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>{c.score_source === 'qwen' ? 'Qwen' : 'Fallback'}</span>
                        </div>
                        <div style={{ fontSize: '0.9rem' }}>{c.title}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{c.category} · {c.ward}</div>
                      </div>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: sConfig?.color || '#64748b' }} />
                        <span style={{ fontSize: '0.8rem', color: sConfig?.color || '#64748b' }}>{sConfig?.label || c.status}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
