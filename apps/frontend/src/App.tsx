import { lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AdminRoute } from "@/components/layout/AdminRoute";
import { AdminLayout } from "@/components/layout/AdminLayout";

// Lazy-loaded so a visitor only downloads the code for the page they're actually on —
// without this, every route (including the whole admin panel) shipped in one ~1.1MB bundle.
const Landing = lazy(() => import("@/pages/Landing"));
const Feed = lazy(() => import("@/pages/Feed"));
const ListingDetail = lazy(() => import("@/pages/ListingDetail"));
const CreateListing = lazy(() => import("@/pages/CreateListing"));
const EditListing = lazy(() => import("@/pages/EditListing"));
const MyActivity = lazy(() => import("@/pages/MyActivity"));
const Verify = lazy(() => import("@/pages/Verify"));
const Profile = lazy(() => import("@/pages/Profile"));
const EditProfile = lazy(() => import("@/pages/EditProfile"));
const Notifications = lazy(() => import("@/pages/Notifications"));
const BuyTokens = lazy(() => import("@/pages/tokens/BuyTokens"));
const Terms = lazy(() => import("@/pages/Terms"));
const Privacy = lazy(() => import("@/pages/Privacy"));
const Safety = lazy(() => import("@/pages/Safety"));
const About = lazy(() => import("@/pages/About"));
const HelpCenter = lazy(() => import("@/pages/HelpCenter"));
const NotFound = lazy(() => import("@/pages/NotFound"));

const Login = lazy(() => import("@/pages/auth/Login"));
const Register = lazy(() => import("@/pages/auth/Register"));
const ForgotPassword = lazy(() => import("@/pages/auth/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/auth/ResetPassword"));
const GoogleCallback = lazy(() => import("@/pages/auth/GoogleCallback"));

const ConversationsList = lazy(() => import("@/pages/chat/ConversationsList"));
const Thread = lazy(() => import("@/pages/chat/Thread"));

const AdminUsers = lazy(() => import("@/pages/admin/Users"));
const AdminUserDetail = lazy(() => import("@/pages/admin/UserDetail"));
const AdminReports = lazy(() => import("@/pages/admin/Reports"));
const AdminAnalytics = lazy(() => import("@/pages/admin/Analytics"));

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        {/* Public */}
        <Route path="/" element={<Landing />} />
        <Route path="/browse" element={<Feed />} />
        <Route path="/listings/new" element={<CreateListing />} />
        <Route path="/listings/:id" element={<ListingDetail />} />
        <Route path="/users/:id" element={<Profile />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/auth/callback" element={<GoogleCallback />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/safety" element={<Safety />} />
        <Route path="/about" element={<About />} />
        <Route path="/help" element={<HelpCenter />} />

        {/* Protected */}
        <Route element={<ProtectedRoute />}>
          <Route path="/listings/:id/edit" element={<EditListing />} />
          <Route path="/profile/edit" element={<EditProfile />} />
          <Route path="/my-activity" element={<MyActivity />} />
          <Route path="/verify" element={<Verify />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/chat" element={<ConversationsList />} />
          <Route path="/chat/:conversationId" element={<Thread />} />
          <Route path="/tokens/buy" element={<BuyTokens />} />
        </Route>

        {/* Admin — its own section at /admin, on the same domain */}
        <Route path="/admin" element={<AdminRoute />}>
          <Route element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/users" replace />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="users/:id" element={<AdminUserDetail />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="analytics" element={<AdminAnalytics />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
