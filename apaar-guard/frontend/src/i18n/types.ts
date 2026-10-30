export type Language = 'en' | 'ta';

export interface TranslationDictionary {
  // Brand & Masthead
  appName: string;
  appSubtitle: string;
  sihPrototype: string;
  portalTitle: string;
  officialNotice: string;
  officialNoticeShort: string;
  languageName: string;
  selectLanguage: string;
  helpdesk: string;
  supportNotConfigured: string;
  configureSupport: string;
  officeHours: string;
  notifications: string;
  noNotifications: string;
  markAllRead: string;
  unreadCount: string;
  userProfile: string;
  roleAdmin: string;
  roleOfficer: string;
  signOut: string;

  // Navigation
  navDashboard: string;
  navStudents: string;
  navAddStudent: string;
  navBulkImport: string;
  navVerification: string;
  navReviewHistory: string;
  navIntake: string;
  navReports: string;
  navAudit: string;
  navRules: string;
  navHelp: string;
  navSettings: string;
  navTools: string;

  // Statuses
  statusReady: string;
  statusReviewRequired: string;
  statusInvalidData: string;
  statusPendingLocalCheck: string;
  statusDeDuplicated: string;
  statusArchived: string;

  // Common UI & Actions
  search: string;
  searchPlaceholder: string;
  filter: string;
  all: string;
  reset: string;
  save: string;
  cancel: string;
  close: string;
  download: string;
  export: string;
  examine: string;
  loading: string;
  rowsPerPage: string;
  showingResults: string;
  pageOf: string;
  previous: string;
  next: string;

  // Help Centre
  helpHeading: string;
  helpSubtitle: string;
  helpDescription: string;
  searchHelpPlaceholder: string;
  supportCardsTitle: string;
  downloadDocsTitle: string;
  videoGuidesTitle: string;
  faqTitle: string;
  videosComingSoon: string;
  videosComingSoonDesc: string;
}

