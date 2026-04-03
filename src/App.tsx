import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Orders from "@/pages/Orders";
import UnassignedOrders from "@/pages/UnassignedOrders";
import ClosedOrders from "@/pages/ClosedOrders";
import GlobalSearch from "@/pages/GlobalSearch";
import Offices from "@/pages/Offices";
import DeliveryPrices from "@/pages/DeliveryPrices";
import Products from "@/pages/Products";
import Couriers from "@/pages/Couriers";
import CourierCollections from "@/pages/CourierCollections";
import OfficeAccounts from "@/pages/OfficeAccounts";
import Advances from "@/pages/Advances";
import PrintSticker from "@/pages/PrintSticker";
import ActivityLogs from "@/pages/ActivityLogs";
import Settings from "@/pages/Settings";
import UsersPage from "@/pages/UsersPage";
import CourierOrders from "@/pages/CourierOrders";
import FinancialReports from "@/pages/FinancialReports";
import CourierStats from "@/pages/CourierStats";
import CourierTracking from "@/pages/CourierTracking";
import InternalChat from "@/pages/InternalChat";
import OfficeStats from "@/pages/OfficeStats";
import CustomersPage from "@/pages/CustomersPage";
import TrackingPage from "@/pages/TrackingPage";
import DailyReport from "@/pages/DailyReport";
import ProfitReport from "@/pages/ProfitReport";
import StatusManagement from "@/pages/StatusManagement";
import OrderNotes from "@/pages/OrderNotes";
import DataExport from "@/pages/DataExport";
import ExcelImport from "@/pages/ExcelImport";
import OfficePortal from "@/pages/OfficePortal";
import OfficeSettlement from "@/pages/OfficeSettlement";
import DiaryOffices from "@/pages/DiaryOffices";
import OfficeDiaries from "@/pages/OfficeDiaries";
import DiaryView from "@/pages/DiaryView";
import AccountingDashboard from "@/pages/AccountingDashboard";
import AccountingLayout from "@/components/AccountingLayout";
import OfficeReport from "@/pages/OfficeReport";
import TrashBin from "@/pages/TrashBin";
import SystemGuide from "@/pages/SystemGuide";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function LoginRedirect() {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (session) return <Navigate to="/" replace />;
  return <Login />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginRedirect />} />
            <Route path="/tracking" element={<TrackingPage />} />
            <Route path="/courier-orders" element={
              <ProtectedRoute><CourierOrders /></ProtectedRoute>
            } />
            <Route path="/office-portal" element={
              <ProtectedRoute><OfficePortal /></ProtectedRoute>
            } />
            {/* Accounting System - separate full layout */}
            <Route path="/accounting-system" element={
              <ProtectedRoute requiredRole="owner_or_admin"><AccountingLayout /></ProtectedRoute>
            }>
              <Route index element={<DiaryOffices />} />
              <Route path="offices/:officeId" element={<OfficeDiaries />} />
              <Route path="offices/:officeId/diary/:diaryId" element={<DiaryView />} />
              <Route path="dashboard" element={<AccountingDashboard />} />
              <Route path="office-settlement" element={<OfficeSettlement />} />
            </Route>
            {/* Main shipping system */}
            <Route element={
              <ProtectedRoute requiredRole="owner_or_admin"><AppLayout /></ProtectedRoute>
            }>
              <Route path="/" element={<Dashboard />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/unassigned-orders" element={<UnassignedOrders />} />
              <Route path="/closed-orders" element={<ClosedOrders />} />
              <Route path="/search" element={<GlobalSearch />} />
              <Route path="/offices" element={<Offices />} />
              <Route path="/delivery-prices" element={<DeliveryPrices />} />
              <Route path="/products" element={<Products />} />
              <Route path="/couriers" element={<Couriers />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/courier-collections" element={<CourierCollections />} />
              <Route path="/collections" element={<Navigate to="/courier-collections" replace />} />
              <Route path="/office-accounts" element={<OfficeAccounts />} />
              <Route path="/advances" element={<Advances />} />
              <Route path="/print" element={<PrintSticker />} />
              <Route path="/logs" element={<ActivityLogs />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/financial-reports" element={<FinancialReports />} />
              <Route path="/courier-stats" element={<CourierStats />} />
              <Route path="/courier-tracking" element={<CourierTracking />} />
              <Route path="/office-stats" element={<OfficeStats />} />
              <Route path="/daily-report" element={<DailyReport />} />
              <Route path="/profit-report" element={<ProfitReport />} />
              <Route path="/status-management" element={<StatusManagement />} />
              <Route path="/order-notes" element={<OrderNotes />} />
              <Route path="/data-export" element={<DataExport />} />
              <Route path="/excel-import" element={<ExcelImport />} />
              <Route path="/office-report" element={<OfficeReport />} />
              <Route path="/trash" element={<TrashBin />} />
              <Route path="/system-guide" element={<SystemGuide />} />
              <Route path="/chat" element={<InternalChat />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
