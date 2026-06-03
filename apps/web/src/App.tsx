import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Spinner } from './components/ui.js';
import { useAuth } from './lib/auth.js';
import type { Role } from '@sanctum/shared';

// Marketing (eager-ish but still split)
const Landing = lazy(() => import('./pages/marketing/Landing.js'));
const About = lazy(() => import('./pages/marketing/About.js'));
const Pricing = lazy(() => import('./pages/marketing/Pricing.js'));
const Find = lazy(() => import('./pages/marketing/Find.js'));
const Privacy = lazy(() => import('./pages/marketing/Privacy.js'));
const PublicFacility = lazy(() => import('./pages/marketing/PublicFacility.js'));
const EventMicrosite = lazy(() => import('./pages/marketing/EventMicrosite.js'));

// Auth
const Login = lazy(() => import('./pages/auth/Login.js'));
const Signup = lazy(() => import('./pages/auth/Signup.js'));

// Operator
const OperatorLayout = lazy(() => import('./pages/operator/OperatorLayout.js'));
const OperatorOverview = lazy(() => import('./pages/operator/Overview.js'));
const OperatorBookings = lazy(() => import('./pages/operator/Bookings.js'));
const OperatorBookingDetail = lazy(() => import('./pages/operator/BookingDetail.js'));
const OperatorCalendar = lazy(() => import('./pages/operator/Calendar.js'));
const OperatorSpaces = lazy(() => import('./pages/operator/Spaces.js'));
const OperatorCompliance = lazy(() => import('./pages/operator/Compliance.js'));
const OperatorPricing = lazy(() => import('./pages/operator/Pricing.js'));
const OperatorInvoices = lazy(() => import('./pages/operator/Invoices.js'));
const OperatorRenters = lazy(() => import('./pages/operator/Renters.js'));
const OperatorLeads = lazy(() => import('./pages/operator/Leads.js'));
const OperatorAnalytics = lazy(() => import('./pages/operator/Analytics.js'));
const OperatorReviews = lazy(() => import('./pages/operator/Reviews.js'));
const OperatorAssistant = lazy(() => import('./pages/operator/Assistant.js'));
const OperatorSettings = lazy(() => import('./pages/operator/Settings.js'));

// Renter
const RenterLayout = lazy(() => import('./pages/renter/RenterLayout.js'));
const RenterFind = lazy(() => import('./pages/renter/Find.js'));
const RenterBookings = lazy(() => import('./pages/renter/Bookings.js'));
const RenterBookingDetail = lazy(() => import('./pages/renter/BookingDetail.js'));
const RenterDocuments = lazy(() => import('./pages/renter/Documents.js'));
const RenterSettings = lazy(() => import('./pages/renter/Settings.js'));
const RenterSites = lazy(() => import('./pages/renter/Sites.js'));
const RenterSiteBuilder = lazy(() => import('./pages/renter/SiteBuilder.js'));
const RenterLearn = lazy(() => import('./pages/renter/Learn.js'));
const BookingFlow = lazy(() => import('./pages/renter/BookingFlow.js'));

// Admin
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout.js'));
const AdminOverview = lazy(() => import('./pages/admin/Overview.js'));
const AdminFacilities = lazy(() => import('./pages/admin/Facilities.js'));
const AdminUsers = lazy(() => import('./pages/admin/Users.js'));
const AdminAnnouncements = lazy(() => import('./pages/admin/Announcements.js'));
const AdminErrors = lazy(() => import('./pages/admin/Errors.js'));

function PageLoader() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Spinner className="h-7 w-7" />
    </div>
  );
}

function Protected({ roles, children }: { roles: Role[]; children: JSX.Element }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (!roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return children;
}

export function homeFor(role: Role): string {
  if (role === 'operator' || role === 'staff') return '/operator';
  if (role === 'admin') return '/admin';
  return '/renter';
}

export function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/about" element={<About />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/find" element={<Find />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/c/:slug" element={<PublicFacility />} />
        <Route path="/e/:slug" element={<EventMicrosite />} />

        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        <Route path="/operator" element={<Protected roles={['operator', 'staff']}><OperatorLayout /></Protected>}>
          <Route index element={<OperatorOverview />} />
          <Route path="calendar" element={<OperatorCalendar />} />
          <Route path="bookings" element={<OperatorBookings />} />
          <Route path="bookings/:id" element={<OperatorBookingDetail />} />
          <Route path="spaces" element={<OperatorSpaces />} />
          <Route path="compliance" element={<OperatorCompliance />} />
          <Route path="pricing" element={<OperatorPricing />} />
          <Route path="invoices" element={<OperatorInvoices />} />
          <Route path="renters" element={<OperatorRenters />} />
          <Route path="leads" element={<OperatorLeads />} />
          <Route path="analytics" element={<OperatorAnalytics />} />
          <Route path="reviews" element={<OperatorReviews />} />
          <Route path="assistant" element={<OperatorAssistant />} />
          <Route path="settings" element={<OperatorSettings />} />
        </Route>

        <Route path="/renter" element={<Protected roles={['renter']}><RenterLayout /></Protected>}>
          <Route index element={<RenterFind />} />
          <Route path="bookings" element={<RenterBookings />} />
          <Route path="bookings/:id" element={<RenterBookingDetail />} />
          <Route path="documents" element={<RenterDocuments />} />
          <Route path="sites" element={<RenterSites />} />
          <Route path="sites/:id" element={<RenterSiteBuilder />} />
          <Route path="learn" element={<RenterLearn />} />
          <Route path="settings" element={<RenterSettings />} />
        </Route>
        <Route path="/book/:facilityId/:spaceId" element={<Protected roles={['renter']}><BookingFlow /></Protected>} />

        <Route path="/admin" element={<Protected roles={['admin']}><AdminLayout /></Protected>}>
          <Route index element={<AdminOverview />} />
          <Route path="facilities" element={<AdminFacilities />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="announcements" element={<AdminAnnouncements />} />
          <Route path="errors" element={<AdminErrors />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
