import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AudioFeedbackProvider } from '@/components/shared/AudioFeedback.js';
import { AdminPinModal } from '@/components/shared/AdminPinModal.js';
import { AppLayout } from '@/layouts/AppLayout.js';
import { KioskLayout } from '@/layouts/KioskLayout.js';
import { DashboardPage } from '@/pages/DashboardPage.js';
import { DocsPage } from '@/pages/DocsPage.js';
import { NotFoundPage } from '@/pages/NotFoundPage.js';
import { CustomersListPage } from '@/pages/customers/CustomersListPage.js';
import { CustomerDetailPage } from '@/pages/customers/CustomerDetailPage.js';
import { ImportsPage } from '@/pages/imports/ImportsPage.js';
import { InventoryPage } from '@/pages/inventory/InventoryPage.js';
import { LookupPrintStationPage } from '@/pages/lookupprint/LookupPrintStationPage.js';
import { OrdersListPage } from '@/pages/orders/OrdersListPage.js';
import { OrderDetailPage } from '@/pages/orders/OrderDetailPage.js';
import { NewOrderPage } from '@/pages/orders/NewOrderPage.js';
import { PickupLookupPage } from '@/pages/pickup/PickupLookupPage.js';
import { PickupScanPage } from '@/pages/pickup/PickupScanPage.js';
import { PickupScanSessionPage } from '@/pages/pickup/PickupScanSessionPage.js';
import { PlantsListPage } from '@/pages/plants/PlantsListPage.js';
import { PlantDetailPage } from '@/pages/plants/PlantDetailPage.js';
import { PrintCheatsheetAdmin } from '@/pages/print/PrintCheatsheetAdmin.js';
import { PrintCheatsheetEndOfDay } from '@/pages/print/PrintCheatsheetEndOfDay.js';
import { PrintCheatsheetLookup } from '@/pages/print/PrintCheatsheetLookup.js';
import { PrintCheatsheetPickup } from '@/pages/print/PrintCheatsheetPickup.js';
import { PrintCheatsheetThermal } from '@/pages/print/PrintCheatsheetThermal.js';
import { PrintOrderBarcodeRollPage } from '@/pages/print/PrintOrderBarcodeRollPage.js';
import { PrintOrderBarcodesBulkPage } from '@/pages/print/PrintOrderBarcodesBulkPage.js';
import { PrintOrderPage } from '@/pages/print/PrintOrderPage.js';
import { PrintOrdersBatchPage } from '@/pages/print/PrintOrdersBatchPage.js';
import { PrintPlantLabelsPage } from '@/pages/print/PrintPlantLabelsPage.js';
import { PrintSellerPacketPage } from '@/pages/print/PrintSellerPacketPage.js';
import { PrintSellersBatchPage } from '@/pages/print/PrintSellersBatchPage.js';
import { PrintCustomerPickListPage } from '@/pages/print/PrintCustomerPickListPage.js';
import { PrintCustomersBatchPage } from '@/pages/print/PrintCustomersBatchPage.js';
import { ReportsPage } from '@/pages/ReportsPage.js';
import { DailySalesPage } from '@/pages/reports/DailySalesPage.js';
import { LeftoverInventoryPage } from '@/pages/reports/LeftoverInventoryPage.js';
import { LiveSaleKpiPage } from '@/pages/reports/LiveSaleKpiPage.js';
import { OutstandingAgingPage } from '@/pages/reports/OutstandingAgingPage.js';
import { PaymentBreakdownPage } from '@/pages/reports/PaymentBreakdownPage.js';
import { SalesByCustomerPage } from '@/pages/reports/SalesByCustomerPage.js';
import { SalesByPlantPage } from '@/pages/reports/SalesByPlantPage.js';
import { SalesBySellerPage } from '@/pages/reports/SalesBySellerPage.js';
import { StatusFunnelPage } from '@/pages/reports/StatusFunnelPage.js';
import { TopMoversPage } from '@/pages/reports/TopMoversPage.js';
import { WalkupVsPreorderPage } from '@/pages/reports/WalkupVsPreorderPage.js';
import { SellersListPage } from '@/pages/sellers/SellersListPage.js';
import { SellerDetailPage } from '@/pages/sellers/SellerDetailPage.js';
import { SettingsPage } from '@/pages/SettingsPage.js';
import { UserManagementPage } from '@/pages/admin/UserManagementPage.js';
import { StationHomePage } from '@/pages/station/StationHomePage.js';
import { RoleRoute } from '@/routes/RoleRoute.js';
import { WalkUpNewOrderPage } from '@/pages/walkup/WalkUpNewOrderPage.js';
import { WalkUpRegisterPage } from '@/pages/walkup/WalkUpRegisterPage.js';
import { useKioskStore } from '@/stores/kioskStore.js';
import { KioskRouteGuard } from '@/routes/KioskRouteGuard.js';
import { ProtectedRoute } from '@/routes/ProtectedRoute.js';
import { LoginPage } from '@/pages/auth/LoginPage.js';
import { AccessDeniedPage } from '@/pages/auth/AccessDeniedPage.js';
import { MobileRouteGuard } from '@/routes/MobileRouteGuard.js';
import { MobileHomePage } from '@/pages/mobile/MobileHomePage.js';
import { MobilePickupLookupPage } from '@/pages/mobile/MobilePickupLookupPage.js';
import { MobilePickupScanPage } from '@/pages/mobile/MobilePickupScanPage.js';
import { MobileOrderLookupPage } from '@/pages/mobile/MobileOrderLookupPage.js';
import { MobileScannerDemoPage } from '@/pages/mobile/MobileScannerDemoPage.js';

function AppShell() {
  const session = useKioskStore((s) => s.session);
  return session ? <KioskLayout /> : <AppLayout />;
}

function App() {
  return (
    <AudioFeedbackProvider>
      <BrowserRouter>
        <Routes>
          <Route path="login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
          <Route element={<KioskRouteGuard />}>
            <Route element={<AppShell />}>
              <Route index element={<DashboardPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route element={<RoleRoute roles={['Admin']} />}>
                <Route path="admin/users" element={<UserManagementPage />} />
              </Route>
              <Route path="plants" element={<PlantsListPage />} />
              <Route path="plants/:id" element={<PlantDetailPage />} />
              <Route path="inventory" element={<InventoryPage />} />
              <Route path="customers" element={<CustomersListPage />} />
              <Route path="customers/:id" element={<CustomerDetailPage />} />
              <Route path="sellers" element={<SellersListPage />} />
              <Route path="sellers/:id" element={<SellerDetailPage />} />
              <Route path="orders" element={<OrdersListPage />} />
              <Route path="orders/new" element={<NewOrderPage />} />
              <Route path="orders/:id/edit" element={<NewOrderPage />} />
              <Route path="orders/:id" element={<OrderDetailPage />} />
              <Route path="station" element={<StationHomePage />} />
              <Route path="pickup" element={<PickupLookupPage />} />
              <Route path="pickup/session/:id" element={<PickupScanSessionPage />} />
              <Route path="pickup/:orderId" element={<PickupScanPage />} />
              <Route path="lookup-print" element={<LookupPrintStationPage />} />
              <Route path="walkup/new" element={<WalkUpNewOrderPage />} />
              <Route path="walkup/register" element={<WalkUpRegisterPage />} />
              <Route path="walkup/register/new" element={<WalkUpRegisterPage />} />
              <Route path="walkup/register/:draftId" element={<WalkUpRegisterPage />} />
              <Route path="imports" element={<ImportsPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="reports/live-sale-kpi" element={<LiveSaleKpiPage />} />
              <Route path="reports/leftover-inventory" element={<LeftoverInventoryPage />} />
              <Route path="reports/sales-by-seller" element={<SalesBySellerPage />} />
              <Route path="reports/sales-by-customer" element={<SalesByCustomerPage />} />
              <Route path="reports/sales-by-plant" element={<SalesByPlantPage />} />
              <Route path="reports/daily-sales" element={<DailySalesPage />} />
              <Route path="reports/payment-breakdown" element={<PaymentBreakdownPage />} />
              <Route path="reports/walkup-vs-preorder" element={<WalkupVsPreorderPage />} />
              <Route path="reports/status-funnel" element={<StatusFunnelPage />} />
              <Route path="reports/top-movers" element={<TopMoversPage />} />
              <Route path="reports/outstanding-aging" element={<OutstandingAgingPage />} />
              <Route path="docs" element={<DocsPage />} />
            </Route>

            <Route path="print/order/:orderId" element={<PrintOrderPage />} />
            <Route path="print/order-barcodes/:orderId" element={<PrintOrderBarcodeRollPage />} />
            <Route path="print/order-barcodes" element={<PrintOrderBarcodesBulkPage />} />
            <Route path="print/orders" element={<PrintOrdersBatchPage />} />
            <Route path="print/seller/:sellerId" element={<PrintSellerPacketPage />} />
            <Route path="print/sellers" element={<PrintSellersBatchPage />} />
            <Route path="print/customer/:customerId" element={<PrintCustomerPickListPage />} />
            <Route path="print/customers" element={<PrintCustomersBatchPage />} />
            <Route path="print/cheatsheet/pickup" element={<PrintCheatsheetPickup />} />
            <Route path="print/cheatsheet/lookup" element={<PrintCheatsheetLookup />} />
            <Route path="print/cheatsheet/admin" element={<PrintCheatsheetAdmin />} />
            <Route path="print/cheatsheet/end-of-day" element={<PrintCheatsheetEndOfDay />} />
            <Route path="print/cheatsheet/thermal-labels" element={<PrintCheatsheetThermal />} />
            <Route path="print/labels" element={<PrintPlantLabelsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
          </Route>

          <Route path="mobile">
            <Route path="access-denied" element={<AccessDeniedPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<MobileRouteGuard />}>
                <Route index element={<MobileHomePage />} />
                <Route path="pickup" element={<MobilePickupLookupPage />} />
                <Route path="pickup/:orderId" element={<MobilePickupScanPage />} />
                <Route path="lookup" element={<MobileOrderLookupPage />} />
                <Route path="scanner-demo" element={<MobileScannerDemoPage />} />
              </Route>
            </Route>
          </Route>
        </Routes>
        <AdminPinModal />
      </BrowserRouter>
    </AudioFeedbackProvider>
  );
}

export default App;
