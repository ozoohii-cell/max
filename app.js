// ===================================================================================
// ✨ SUPABASE 설정: 아래 변수들을 당신의 Supabase 프로젝트 정보로 교체해주세요!
// ===================================================================================
const SUPABASE_URL = 'https://aeleuwbpvtpmgnomftlh.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlbGV1d2JwdnRwbWdub21mdGxoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY2OTEzNjgsImV4cCI6MjA3MjI2NzM2OH0.0ov52DVEOrYn7TbcP0Zu-206ZnrHPo5CbWsHm3QXHvo';
// ===================================================================================

let supabaseClient;

// 앱 전역에서 사용될 데이터 캐시
let allData = {
    customers: [],
    cars: [],
    serviceCategories: [],
    serviceItems: [],
    affiliatedCompanies: [],
    carNames: [],
    suppliers: [],
    prefixes: []
};

// 현재 페이지 상태
let selectedCustomer = null;
let currentEditingOrder = null;
let activeItemEntryRow = null; // stock-input.html에서 사용

if (typeof supabase !== 'undefined' && SUPABASE_URL && SUPABASE_URL !== 'YOUR_SUPABASE_URL') {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

// ===================================================================================
// 초기화 및 공통 로직
// ===================================================================================

async function loadCommonComponents() {
    try {
        const response = await fetch('modals.html');
        if (!response.ok) throw new Error('modals.html 파일을 찾을 수 없습니다.');
        
        const text = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');
        
        document.getElementById('modal-container')?.append(...doc.querySelectorAll('.modal-template'));
        document.getElementById('notification-container')?.append(doc.getElementById('notification'));
        
        const itemEntryTemplate = document.getElementById('item-entry-template');
        if (itemEntryTemplate && doc.getElementById('item-entry-template-content')) {
            itemEntryTemplate.innerHTML = doc.getElementById('item-entry-template-content').innerHTML;
        }

        const serviceItemTemplate = document.getElementById('service-item-template');
        if (serviceItemTemplate && doc.getElementById('service-item-template-content')) {
            serviceItemTemplate.innerHTML = doc.getElementById('service-item-template-content').innerHTML;
        }

    } catch (error) {
        console.error("공통 컴포넌트 로딩 실패:", error);
        document.body.innerHTML = `<div class="p-4 bg-red-100 text-red-700"><strong>오류:</strong> ${error.message}. 모든 HTML 파일과 app.js가 같은 폴더에 있는지 확인해주세요.</div>`;
    }
}

function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    const notificationMessage = document.getElementById('notification-message');
    if (!notification || !notificationMessage) return;

    notificationMessage.textContent = message;
    notification.className = `fixed bottom-5 right-5 text-white py-3 px-6 rounded-lg shadow-xl transition-all duration-300 ${type === 'success' ? 'bg-green-500' : 'bg-red-500'}`;
    notification.classList.remove('hidden');
    setTimeout(() => { notification.classList.add('hidden'); }, 3000);
}

function setLoading(button, isLoading) {
    if (!button) return;
    button.disabled = isLoading;
    const buttonText = button.querySelector('span');
    const buttonSpinner = button.querySelector('svg');
    if (buttonText) buttonText.classList.toggle('hidden', isLoading);
    if (buttonSpinner) buttonSpinner.classList.toggle('hidden', !isLoading);
}

function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('hidden');
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
        const form = modal.querySelector('form');
        if (form) form.reset();

        // 특별히 숨겨야 할 요소들 초기화
        const affiliatedWrapper = document.getElementById('affiliated-company-wrapper');
        if(affiliatedWrapper) affiliatedWrapper.classList.add('hidden');
    }
}

// ===================================================================================
// 대시보드 (index.html) 관련 스크립트
// ===================================================================================
async function initializeDashboard() {
    await loadInitialData(); // 모달이 사용될 수 있으므로 기본 데이터 로드
    setupModalEventListeners(); // 모달 이벤트 리스너 설정

    const waitingCarsList = document.getElementById('waiting-cars-list');
    const inProgressCarsList = document.getElementById('in-progress-cars-list');

    function renderWorkStatusList(element, orders, status) {
        element.innerHTML = '';
        const filteredOrders = orders.filter(o => o.status === status);
        if (filteredOrders.length === 0) {
            element.innerHTML = `<p class="text-slate-500">해당 상태의 차량이 없습니다.</p>`;
            return;
        }
        filteredOrders.forEach(order => {
            const carInfo = `${order.cars.car_plate_number} (${order.cars.car_model || '차종 미입력'})`;
            const item = document.createElement('div');
            item.className = 'p-3 bg-slate-50 rounded-md hover:bg-slate-100 cursor-pointer';
            item.innerHTML = `
                <p class="font-semibold text-slate-800">${order.customers.customer_name} - ${carInfo}</p>
                <p class="text-sm text-slate-600">입고: ${new Date(order.in_date).toLocaleDateString()}</p>
            `;
            item.addEventListener('click', () => window.location.href = `work-order-form.html?id=${order.work_order_id}`);
            element.appendChild(item);
        });
    }

    async function loadDashboardData() {
        try {
            const { data: orders, error } = await supabaseClient
                .from('work_orders')
                .select(`*, customers(customer_name), cars(car_plate_number, car_model)`)
                .neq('status', '완료')
                .order('in_date', { ascending: true });
            if (error) throw error;
            renderWorkStatusList(waitingCarsList, orders, '대기');
            renderWorkStatusList(inProgressCarsList, orders, '작업중');
        } catch (error) {
            console.error("대시보드 데이터 로딩 실패:", error);
            showNotification("데이터 로딩에 실패했습니다.", "error");
        }
    }
    
    document.getElementById('add-customer-button')?.addEventListener('click', () => showModal('customer-modal'));
    document.getElementById('add-company-button')?.addEventListener('click', () => showModal('supplier-modal'));
    document.getElementById('add-car-button')?.addEventListener('click', () => showModal('car-modal'));
    
    loadDashboardData();
}


// ===================================================================================
// 작업지시서 (work-order-form.html) 관련 스크립트
// ===================================================================================
function initializeWorkOrderForm() {
    // ... (work-order-form.html의 모든 JS 로직을 여기에 붙여넣습니다)
}


// ===================================================================================
// 재고 입력 (stock-input.html) 관련 스크립트
// ===================================================================================
function initializeStockForm() {
    // ... (stock-input.html의 모든 JS 로직을 여기에 붙여넣습니다)
}

// ===================================================================================
// 공통 모달 및 이벤트 리스너 (모든 페이지에서 작동)
// ===================================================================================
function setupModalEventListeners() {
    // ... (모든 모달의 폼 제출, 자동완성 등 이벤트 리스너 설정)
}

async function loadInitialData() {
    try {
        const [
            { data: customers }, { data: cars }, { data: serviceCategories }, 
            { data: serviceItems }, { data: affiliatedCompanies }, { data: carNames },
            { data: suppliers }, { data: prefixes }
        ] = await Promise.all([
            supabaseClient.from('customers').select('*'),
            supabaseClient.from('cars').select('*'),
            supabaseClient.from('service_categories').select('*'),
            supabaseClient.from('service_items').select('*'),
            supabaseClient.from('affiliated_companies').select('*'),
            supabaseClient.from('car_name').select('car_name'),
            supabaseClient.from('suppliers').select('*'),
            supabaseClient.from('serial_number_prefixes').select('*')
        ]);
        
        allData = { customers, cars, serviceCategories, serviceItems, affiliatedCompanies, carNames, suppliers, prefixes };

    } catch(error) {
        console.error('초기 데이터 로딩 실패:', error);
        showNotification('데이터 로딩에 실패했습니다.', 'error');
    }
}

