import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AudioFeedbackProvider } from '@/components/shared/AudioFeedback.js';
import { AppLayout } from '@/layouts/AppLayout.js';
import { DocsPage } from '@/pages/DocsPage.js';
import { PrintOrderPage } from '@/pages/print/PrintOrderPage.js';
import { PrintSellerPacketPage } from '@/pages/print/PrintSellerPacketPage.js';
import { PrintCheatsheetPickup } from '@/pages/print/PrintCheatsheetPickup.js';
import { PrintCheatsheetLookup } from '@/pages/print/PrintCheatsheetLookup.js';
import { PrintCheatsheetAdmin } from '@/pages/print/PrintCheatsheetAdmin.js';
import { PrintCheatsheetEndOfDay } from '@/pages/print/PrintCheatsheetEndOfDay.js';
import { PrintPlantLabelsPage } from '@/pages/print/PrintPlantLabelsPage.js';
import { PickupLookupPage } from '@/pages/pickup/PickupLookupPage.js';
import { PickupScanPage } from '@/pages/pickup/PickupScanPage.js';
import { DashboardPage } from '@/pages/DashboardPage.js';
import { ReportsPage } from '@/pages/ReportsPage.js';
import { LeftoverInventoryPage } from '@/pages/reports/LeftoverInventoryPage.js';
import { SettingsPage } from '@/pages/SettingsPage.js';
import { PlantsListPage } from '@/pages/plants/PlantsListPage.js';
import { PlantDetailPage } from '@/pages/plants/PlantDetailPage.js';
import { InventoryPage } from '@/pages/inventory/InventoryPage.js';
import { CustomersListPage } from '@/pages/customers/CustomersListPage.js';
import { CustomerDetailPage } from '@/pages/customers/CustomerDetailPage.js';
import { SellersListPage } from '@/pages/sellers/SellersListPage.js';
import { SellerDetailPage } from '@/pages/sellers/SellerDetailPage.js';
import { OrdersListPage } from '@/pages/orders/OrdersListPage.js';
import { OrderDetailPage } from '@/pages/orders/OrderDetailPage.js';
import { NewOrderPage } from '@/pages/orders/NewOrderPage.js';
import { ImportsPage } from '@/pages/imports/ImportsPage.js';
import { WalkUpNewOrderPage } from '@/pages/walkup/WalkUpNewOrderPage.js';
import { StationHomePage } from '@/pages/station/StationHomePage.js';

function App() {
  return (
    <AudioFeedbackProvider>
      <BrowserRouter>
        <Routes>
          {/* Main app routes wrapped in layout */}
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="plants" element={<PlantsListPage />} />
            <Route path="plants/:id" element={<PlantDetailPage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="customers" element={<CustomersListPage />} />
            <Route path="customers/:id" element={<CustomerDetailPage />} />
            <Route path="sellers" element={<SellersListPage />} />
            <Route path="sellers/:id" element={<SellerDetailPage />} />
            <Route path="orders" element={<OrdersListPage />} />
            <Route path="orders/new" element={<NewOrderPage />} />
            <Route path="orders/:id" element={<OrderDetailPage />} />
            <Route path="station" element={<StationHomePage />} />
            <Route path="pickup" element={<PickupLookupPage />} />
            <Route path="pickup/:orderId" element={<PickupScanPage />} />
            <Route path="walkup/new" element={<WalkUpNewOrderPage />} />
            <Route path="imports" element={<ImportsPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="reports/leftover-inventory" element={<LeftoverInventoryPage />} />
            <Route path="docs" element={<DocsPage />} />
          </Route>

          {/* Print routes -- no layout wrapper */}
          <Route path="print/order/:orderId" element={<PrintOrderPage />} />
          <Route path="print/seller/:sellerId" element={<PrintSellerPacketPage />} />
          <Route path="print/cheatsheet/pickup" element={<PrintCheatsheetPickup />} />
          <Route path="print/cheatsheet/lookup" element={<PrintCheatsheetLookup />} />
          <Route path="print/cheatsheet/admin" element={<PrintCheatsheetAdmin />} />
          <Route path="print/cheatsheet/end-of-day" element={<PrintCheatsheetEndOfDay />} />
          <Route path="print/labels" element={<PrintPlantLabelsPage />} />
        </Routes>
      </BrowserRouter>
    </AudioFeedbackProvider>
  );
}

export default App;
