import { Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AdminRoute } from "@/components/layout/AdminRoute";
import { AdminLayout } from "@/components/layout/AdminLayout";

import Landing from "@/pages/Landing";
import Feed from "@/pages/Feed";
import ListingDetail from "@/pages/ListingDetail";
import CreateListing from "@/pages/CreateListing";
import EditListing from "@/pages/EditListing";
import MyActivity from "@/pages/MyActivity";
import Verify from "@/pages/Verify";
import Profile from "@/pages/Profile";
import EditProfile from "@/pages/EditProfile";
import Notifications from "@/pages/Notifications";
import BuyTokens from "@/pages/tokens/BuyTokens";
import Terms from "@/pages/Terms";
import Privacy from "@/pages/Privacy";
import Safety from "@/pages/Safety";
import About from "@/pages/About";
import HelpCenter from "@/pages/HelpCenter";
import NotFound from "@/pages/NotFound";

import Login from "@/pages/auth/Login";
import Register from "@/pages/auth/Register";
import ForgotPassword from "@/pages/auth/ForgotPassword";
import ResetPassword from "@/pages/auth/ResetPassword";
import GoogleCallback from "@/pages/auth/GoogleCallback";

import ConversationsList from "@/pages/chat/ConversationsList";
import Thread from "@/pages/chat/Thread";

import AdminUsers from "@/pages/admin/Users";
import AdminUserDetail from "@/pages/admin/UserDetail";
import AdminReports from "@/pages/admin/Reports";
import AdminAnalytics from "@/pages/admin/Analytics";

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
