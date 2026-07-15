import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Spinner } from './components/ui.js';
import { useAuth } from './lib/auth.js';
import type { Role } from '@sanctum/shared';

// Marketing (eager-ish but still split)
const Landing = lazy(() => import('./pages/marketing/Landing.js'));
const About = lazy(() => import('./pages/marketing/About.js'));
const Pricing = lazy(() => import('./pages/marketing/Pricing.js'));
const Features = lazy(() => import('./pages/marketing/Features.js'));
const Find = lazy(() => import('./pages/marketing/Find.js'));
const Privacy = lazy(() => import('./pages/marketing/Privacy.js'));
const Terms = lazy(() => import('./pages/marketing/Terms.js'));
const PublicFacility = lazy(() => import('./pages/marketing/PublicFacility.js'));
const EventMicrosite = lazy(() => import('./pages/marketing/EventMicrosite.js'));
const NetworkPage = lazy(() => import('./pages/marketing/NetworkPage.js'));

// Auth
const Login = lazy(() => import('./pages/auth/Login.js'));
const Signup = lazy(() => import('./pages/auth/Signup.js'));
const Forgot = lazy(() => import('./pages/auth/Forgot.js'));
const Reset = lazy(() => import('./pages/auth/Reset.js'));

// Operator
const OperatorLayout = lazy(() => import('./pages/operator/OperatorLayout.js'));
const OperatorOverview = lazy(() => import('./pages/operator/Overview.js'));
const OperatorBookings = lazy(() => import('./pages/operator/Bookings.js'));
const OperatorBookingDetail = lazy(() => import('./pages/operator/BookingDetail.js'));
const OperatorCalendar = lazy(() => import('./pages/operator/Calendar.js'));
const OperatorSpaces = lazy(() => import('./pages/operator/Spaces.js'));
const OperatorTenants = lazy(() => import('./pages/operator/Tenants.js'));
const OperatorTenantDetail = lazy(() => import('./pages/operator/TenantDetail.js'));
const OperatorCompliance = lazy(() => import('./pages/operator/Compliance.js'));
const OperatorPricing = lazy(() => import('./pages/operator/Pricing.js'));
const OperatorInvoices = lazy(() => import('./pages/operator/Invoices.js'));
const OperatorRenters = lazy(() => import('./pages/operator/Renters.js'));
const OperatorRenterDetail = lazy(() => import('./pages/operator/RenterDetail.js'));
const OperatorLeads = lazy(() => import('./pages/operator/Leads.js'));
const OperatorAnalytics = lazy(() => import('./pages/operator/Analytics.js'));
const OperatorFinancials = lazy(() => import('./pages/operator/Financials.js'));
const OperatorReviews = lazy(() => import('./pages/operator/Reviews.js'));
const OperatorAssistant = lazy(() => import('./pages/operator/Assistant.js'));
const OperatorSettings = lazy(() => import('./pages/operator/Settings.js'));
const OperatorNetwork = lazy(() => import('./pages/operator/Network.js'));
const Onboarding = lazy(() => import('./pages/operator/Onboarding.js'));

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
const AdminCustomers = lazy(() => import('./pages/admin/Customers.js'));
const AdminCustomerDetail = lazy(() => import('./pages/admin/CustomerDetail.js'));
const AdminNetworks = lazy(() => import('./pages/admin/Networks.js'));
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
    <>
      {/* Keyboard/screen-reader users can jump past navigation to the content. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-card focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>
      <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/about" element={<About />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/features" element={<Features />} />
        <Route path="/find" element={<Find />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/c/:slug" element={<PublicFacility />} />
        <Route path="/e/:slug" element={<EventMicrosite />} />
        <Route path="/n/:slug" element={<NetworkPage />} />

        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot" element={<Forgot />} />
        <Route path="/reset" element={<Reset />} />

        <Route path="/operator" element={<Protected roles={['operator', 'staff']}><OperatorLayout /></Protected>}>
          <Route index element={<OperatorOverview />} />
          <Route path="calendar" element={<OperatorCalendar />} />
          <Route path="bookings" element={<OperatorBookings />} />
          <Route path="bookings/:id" element={<OperatorBookingDetail />} />
          <Route path="spaces" element={<OperatorSpaces />} />
          <Route path="tenants" element={<OperatorTenants />} />
          <Route path="tenants/:id" element={<OperatorTenantDetail />} />
          <Route path="compliance" element={<OperatorCompliance />} />
          <Route path="pricing" element={<OperatorPricing />} />
          <Route path="invoices" element={<OperatorInvoices />} />
          <Route path="renters" element={<OperatorRenters />} />
          <Route path="renters/:id" element={<OperatorRenterDetail />} />
          <Route path="leads" element={<OperatorLeads />} />
          <Route path="analytics" element={<OperatorAnalytics />} />
          <Route path="financials" element={<OperatorFinancials />} />
          <Route path="reviews" element={<OperatorReviews />} />
          <Route path="assistant" element={<OperatorAssistant />} />
          <Route path="network" element={<OperatorNetwork />} />
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
        <Route path="/onboarding" element={<Protected roles={['operator', 'staff']}><Onboarding /></Protected>} />
        <Route path="/book/:facilityId/:spaceId" element={<Protected roles={['renter']}><BookingFlow /></Protected>} />

        <Route path="/admin" element={<Protected roles={['admin']}><AdminLayout /></Protected>}>
          <Route index element={<AdminOverview />} />
          <Route path="customers" element={<AdminCustomers />} />
          <Route path="customers/:id" element={<AdminCustomerDetail />} />
          <Route path="facilities" element={<AdminFacilities />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="networks" element={<AdminNetworks />} />
          <Route path="announcements" element={<AdminAnnouncements />} />
          <Route path="errors" element={<AdminErrors />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </>
  );
}
