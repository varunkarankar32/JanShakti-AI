export interface Complaint {
  id: string;
  title: string;
  description: string;
  category: string;
  ward: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  status: 'open' | 'assigned' | 'in_progress' | 'verified' | 'resolved';
  citizenName: string;
  location: { lat: number; lng: number };
  createdAt: string;
  updatedAt: string;
  aiScore: number;
  sentiment: number;
  inputMode: 'voice' | 'text' | 'photo';
}

export interface DashboardStats {
  totalIssues: number;
  resolutionRate: number;
  avgResponseDays: number;
  citizenSatisfaction: number;
  trustIndexChange: number;
  resolvedThisWeek: number;
  inProgress: number;
  newComplaints: number;
}

export interface SentimentData {
  ward: string;
  positive: number;
  negative: number;
  neutral: number;
  date: string;
}

export interface SocialPost {
  id: string;
  platform: string;
  content: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  location: string;
  timestamp: string;
  engagement: number;
  isMisinfo: boolean;
}

export const CATEGORIES = [
  'Water Supply', 'Roads & Potholes', 'Drainage', 'Electricity',
  'Garbage Collection', 'Street Lights', 'Public Safety', 'Parks & Gardens',
  'Building & Construction', 'Noise Pollution', 'Air Quality', 'Public Health'
];

export const WARDS = Array.from({ length: 20 }, (_, i) => `Ward ${i + 1}`);

export const PRIORITY_CONFIG = {
  P0: { label: 'Critical', color: '#ef4444', bg: 'rgba(239,68,68,0.15)', response: '< 1 hour' },
  P1: { label: 'High', color: '#f97316', bg: 'rgba(249,115,22,0.15)', response: '< 6 hours' },
  P2: { label: 'Medium', color: '#eab308', bg: 'rgba(234,179,8,0.15)', response: '< 48 hours' },
  P3: { label: 'Routine', color: '#22c55e', bg: 'rgba(34,197,94,0.15)', response: '< 2 weeks' },
};

export const STATUS_CONFIG = {
  open: { label: 'Open', color: '#ef4444' },
  assigned: { label: 'Assigned', color: '#f97316' },
  in_progress: { label: 'In Progress', color: '#eab308' },
  verified: { label: 'Verified', color: '#3b82f6' },
  resolved: { label: 'Resolved', color: '#22c55e' },
};

export const mockComplaints: Complaint[] = [
  {
    id: 'TKT-4521', title: 'Water pipe burst on Main Road',
    description: 'Broken water pipe flooding the entire street, 3 days unresolved. Children cannot go to school.',
    category: 'Water Supply', ward: 'Ward 7', priority: 'P0', status: 'in_progress',
    citizenName: 'Sunita Devi', location: { lat: 25.3176, lng: 82.9739 },
    createdAt: '2026-03-11T06:00:00', updatedAt: '2026-03-11T10:15:00',
    aiScore: 97, sentiment: -0.8, inputMode: 'voice'
  },
  {
    id: 'TKT-4522', title: 'Gas leak near Government School',
    description: 'Strong gas smell near school compound. 500+ students at risk. Immediate action required.',
    category: 'Public Safety', ward: 'Ward 12', priority: 'P0', status: 'assigned',
    citizenName: 'Raju Kumar', location: { lat: 25.6093, lng: 85.1376 },
    createdAt: '2026-03-13T07:30:00', updatedAt: '2026-03-13T07:32:00',
    aiScore: 99, sentiment: -0.95, inputMode: 'photo'
  },
  {
    id: 'TKT-4523', title: 'Main road cave-in blocking ambulance route',
    description: 'Large sinkhole on NH-30 near civil hospital. Ambulances diverted causing 20 min delays.',
    category: 'Roads & Potholes', ward: 'Ward 3', priority: 'P1', status: 'in_progress',
    citizenName: 'Amit Sharma', location: { lat: 25.4358, lng: 81.8463 },
    createdAt: '2026-03-12T14:00:00', updatedAt: '2026-03-12T16:30:00',
    aiScore: 91, sentiment: -0.7, inputMode: 'photo'
  },
  {
    id: 'TKT-4524', title: 'Streetlights out on residential lane',
    description: 'All 8 streetlights on Nehru Lane non-functional for 5 days. Safety concern for women.',
    category: 'Street Lights', ward: 'Ward 5', priority: 'P2', status: 'assigned',
    citizenName: 'Priya Sharma', location: { lat: 22.7196, lng: 75.8577 },
    createdAt: '2026-03-08T19:00:00', updatedAt: '2026-03-10T09:00:00',
    aiScore: 68, sentiment: -0.5, inputMode: 'text'
  },
  {
    id: 'TKT-4525', title: 'Garbage not collected for 1 week',
    description: 'Municipal garbage truck has not visited Sector 8 in 7 days. Stench unbearable.',
    category: 'Garbage Collection', ward: 'Ward 8', priority: 'P2', status: 'open',
    citizenName: 'Mohammad Irfan', location: { lat: 26.8467, lng: 80.9462 },
    createdAt: '2026-03-10T08:00:00', updatedAt: '2026-03-10T08:00:00',
    aiScore: 72, sentiment: -0.6, inputMode: 'text'
  },
  {
    id: 'TKT-4526', title: 'Sewage overflow in residential area',
    description: 'Sewage manhole overflowing near children\'s park. Health hazard for entire colony.',
    category: 'Drainage', ward: 'Ward 7', priority: 'P1', status: 'in_progress',
    citizenName: 'Sunita Devi', location: { lat: 25.3196, lng: 82.9759 },
    createdAt: '2026-03-09T06:30:00', updatedAt: '2026-03-11T11:00:00',
    aiScore: 88, sentiment: -0.85, inputMode: 'voice'
  },
  {
    id: 'TKT-4527', title: 'Park bench needs repainting',
    description: 'Two benches in community garden need fresh paint. Minor cosmetic issue.',
    category: 'Parks & Gardens', ward: 'Ward 15', priority: 'P3', status: 'open',
    citizenName: 'Deepak Verma', location: { lat: 28.6139, lng: 77.2090 },
    createdAt: '2026-03-07T10:00:00', updatedAt: '2026-03-07T10:00:00',
    aiScore: 15, sentiment: 0.1, inputMode: 'text'
  },
  {
    id: 'TKT-4528', title: 'Pothole cluster near school zone',
    description: '3 major potholes on school approach road. 2m x 1m estimated size. Traffic hazard.',
    category: 'Roads & Potholes', ward: 'Ward 9', priority: 'P1', status: 'verified',
    citizenName: 'Anjali Gupta', location: { lat: 26.4499, lng: 80.3319 },
    createdAt: '2026-03-06T07:00:00', updatedAt: '2026-03-13T09:00:00',
    aiScore: 85, sentiment: -0.4, inputMode: 'photo'
  },
  {
    id: 'TKT-4529', title: 'Water contamination reported',
    description: 'Brown/muddy water coming from taps in entire Sector 8. Multiple families affected.',
    category: 'Water Supply', ward: 'Ward 8', priority: 'P0', status: 'resolved',
    citizenName: 'Rahul Singh', location: { lat: 26.8497, lng: 80.9492 },
    createdAt: '2026-03-05T07:00:00', updatedAt: '2026-03-07T16:00:00',
    aiScore: 94, sentiment: -0.9, inputMode: 'voice'
  },
  {
    id: 'TKT-4530', title: 'Illegal construction noise at night',
    description: 'Construction noise from unauthorized building between 11 PM - 4 AM. Disturbing sleep.',
    category: 'Noise Pollution', ward: 'Ward 11', priority: 'P2', status: 'assigned',
    citizenName: 'Kavita Reddy', location: { lat: 17.3850, lng: 78.4867 },
    createdAt: '2026-03-12T23:30:00', updatedAt: '2026-03-13T10:00:00',
    aiScore: 55, sentiment: -0.55, inputMode: 'text'
  },
];

export const mockDashboardStats: DashboardStats = {
  totalIssues: 1247,
  resolutionRate: 89,
  avgResponseDays: 2.3,
  citizenSatisfaction: 4.2,
  trustIndexChange: 23,
  resolvedThisWeek: 23,
  inProgress: 8,
  newComplaints: 15,
};

export const mockTrendData = [
  { week: 'W1', complaints: 45, resolved: 38, satisfaction: 3.8 },
  { week: 'W2', complaints: 52, resolved: 44, satisfaction: 3.9 },
  { week: 'W3', complaints: 38, resolved: 35, satisfaction: 4.0 },
  { week: 'W4', complaints: 61, resolved: 55, satisfaction: 4.1 },
  { week: 'W5', complaints: 48, resolved: 46, satisfaction: 4.2 },
  { week: 'W6', complaints: 55, resolved: 50, satisfaction: 4.3 },
  { week: 'W7', complaints: 42, resolved: 40, satisfaction: 4.2 },
  { week: 'W8', complaints: 36, resolved: 34, satisfaction: 4.4 },
];

export const mockSentimentData: SentimentData[] = [
  { ward: 'Ward 1', positive: 65, negative: 20, neutral: 15, date: '2026-03-13' },
  { ward: 'Ward 2', positive: 45, negative: 35, neutral: 20, date: '2026-03-13' },
  { ward: 'Ward 3', positive: 30, negative: 50, neutral: 20, date: '2026-03-13' },
  { ward: 'Ward 5', positive: 71, negative: 18, neutral: 11, date: '2026-03-13' },
  { ward: 'Ward 7', positive: 28, negative: 55, neutral: 17, date: '2026-03-13' },
  { ward: 'Ward 8', positive: 40, negative: 42, neutral: 18, date: '2026-03-13' },
  { ward: 'Ward 9', positive: 58, negative: 25, neutral: 17, date: '2026-03-13' },
  { ward: 'Ward 12', positive: 22, negative: 62, neutral: 16, date: '2026-03-13' },
];

export const mockSocialPosts: SocialPost[] = [
  {
    id: 'SP-1', platform: 'Twitter', content: 'Brown water coming from taps in Sector 8 since morning! @WaterDept please help! ',
    sentiment: 'negative', location: 'Ward 8', timestamp: '2026-03-13T07:15:00', engagement: 234, isMisinfo: false,
  },
  {
    id: 'SP-2', platform: 'Twitter', content: 'PM Awas Yojana has been CANCELLED! Don\'t apply anymore. Government lied to us!',
    sentiment: 'negative', location: 'Ward 3', timestamp: '2026-03-13T08:30:00', engagement: 12500, isMisinfo: true,
  },
  {
    id: 'SP-3', platform: 'Facebook', content: 'Finally the garbage trucks deployed in Ward 5! Thank you ward officer  Clean streets after months!',
    sentiment: 'positive', location: 'Ward 5', timestamp: '2026-03-13T09:00:00', engagement: 567, isMisinfo: false,
  },
  {
    id: 'SP-4', platform: 'Twitter', content: 'Flooding alert! Zone 3 drains are blocked. Water entering homes. Need help ASAP!',
    sentiment: 'negative', location: 'Ward 3', timestamp: '2026-03-13T06:45:00', engagement: 1890, isMisinfo: false,
  },
  {
    id: 'SP-5', platform: 'WhatsApp', content: 'Road near school repaired in just 2 days! Impressed with new system. Rating 5/5 ⭐',
    sentiment: 'positive', location: 'Ward 9', timestamp: '2026-03-13T10:00:00', engagement: 89, isMisinfo: false,
  },
  {
    id: 'SP-6', platform: 'Twitter', content: 'Gas leak near Government School in Ward 12! Kids are being evacuated! Where is the administration?',
    sentiment: 'negative', location: 'Ward 12', timestamp: '2026-03-13T07:35:00', engagement: 4500, isMisinfo: false,
  },
];

export const mockCategoryDistribution = [
  { name: 'Water Supply', value: 28, color: '#3b82f6' },
  { name: 'Roads', value: 22, color: '#f97316' },
  { name: 'Drainage', value: 15, color: '#8b5cf6' },
  { name: 'Electricity', value: 12, color: '#eab308' },
  { name: 'Garbage', value: 10, color: '#10b981' },
  { name: 'Safety', value: 8, color: '#ef4444' },
  { name: 'Others', value: 5, color: '#64748b' },
];

export const mockWardHeatData = [
  { ward: 'Ward 1', lat: 25.32, lng: 82.97, complaints: 45, severity: 'low' },
  { ward: 'Ward 3', lat: 25.34, lng: 82.98, complaints: 120, severity: 'high' },
  { ward: 'Ward 5', lat: 25.30, lng: 82.96, complaints: 30, severity: 'low' },
  { ward: 'Ward 7', lat: 25.33, lng: 82.99, complaints: 95, severity: 'high' },
  { ward: 'Ward 8', lat: 25.31, lng: 83.00, complaints: 78, severity: 'medium' },
  { ward: 'Ward 9', lat: 25.35, lng: 82.95, complaints: 52, severity: 'medium' },
  { ward: 'Ward 12', lat: 25.36, lng: 82.97, complaints: 110, severity: 'high' },
  { ward: 'Ward 15', lat: 25.29, lng: 82.98, complaints: 25, severity: 'low' },
];

export const mockAlerts = [
  { id: 1, type: 'critical', message: 'Gas leak reported near Govt. School, Ward 12', time: '2 min ago', icon: '' },
  { id: 2, type: 'warning', message: 'Complaint spike detected in Ward 3 (+200%)', time: '15 min ago', icon: '️' },
  { id: 3, type: 'info', message: 'Negative sentiment surging in Ward 7 social media', time: '30 min ago', icon: '' },
  { id: 4, type: 'critical', message: 'P0 issue overdue: Water contamination Ward 8', time: '1 hour ago', icon: '' },
  { id: 5, type: 'success', message: 'Ward 5 satisfaction jumped to 71% (+43% this week)', time: '2 hours ago', icon: '' },
];

export const mockActionQueue = [
  { rank: 1, task: 'Approve gas leak evacuation protocol — Ward 12', priority: 'P0' as const, category: 'Public Safety' },
  { rank: 2, task: 'Review water pipe repair verification photos — Ward 7', priority: 'P0' as const, category: 'Water Supply' },
  { rank: 3, task: 'Respond to misinformation about PM Awas Yojana', priority: 'P1' as const, category: 'Social Media' },
  { rank: 4, task: 'Approve road repair budget for NH-30 sinkhole', priority: 'P1' as const, category: 'Roads' },
  { rank: 5, task: 'Review weekly ward report before publication', priority: 'P2' as const, category: 'Communication' },
];
