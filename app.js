// ===================================================================================
// ✨ SUPABASE 설정: 아래 변수들을 당신의 Supabase 프로젝트 정보로 교체해주세요!
// ===================================================================================
const SUPABASE_URL = 'https://aeleuwbpvtpmgnomftlh.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlbGV1d2JwdnRwbWdub21mdGxoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY2OTEzNjgsImV4cCI6MjA3MjI2NzM2OH0.0ov52DVEOrYn7TbcP0Zu-206ZnrHPo5CbWsHm3QXHvo'; // 여기에 당신의 anon public 키를 붙여넣으세요.
// ===================================================================================

let supabaseClient;
let allCustomers = [], allCars = [], allServiceCategories = [], allServiceItems = [], allAffiliatedCompanies = [], allCarNames = [], allSuppliers = [], allPrefixes = [];
let selectedCustomer = null;
let currentEditingOrder = null;
let activeItemEntryRow = null;

if (typeof supabase !== 'undefined' && SUPABASE_URL && SUPABASE_URL !== 'YOUR_SUPABASE_URL') {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

// ===================================================================================
// 공통 유틸리티 함수
// ===================================================================================

async function loadCommonComponents() {
    try {
        const response = await fetch('modals.html');
        if (!response.ok) throw new Error('modals.html 파일을 찾을 수 없습니다.');
        
        const text = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');
        
        const modalContainer = document.getElementById('modal-container');
        const notificationContainer = document.getElementById('notification-container');
        const itemEntryTemplate = document.getElementById('item-entry-template');
        const serviceItemTemplate = document.getElementById('service-item-template');

        if (modalContainer) {
            doc.querySelectorAll('.modal-template').forEach(modal => {
                modalContainer.appendChild(modal.cloneNode(true));
            });
        }
        if (notificationContainer) {
             const notificationEl = doc.getElementById('notification');
             if(notificationEl) notificationContainer.appendChild(notificationEl.cloneNode(true));
        }
        if(itemEntryTemplate && doc.getElementById('item-entry-template-content')){
            itemEntryTemplate.innerHTML = doc.getElementById('item-entry-template-content').innerHTML;
        }
        if(serviceItemTemplate && doc.getElementById('service-item-template-content')){
            serviceItemTemplate.innerHTML = doc.getElementById('service-item-template-content').innerHTML;
        }

    } catch (error) {
        console.error("공통 컴포넌트 로딩 실패:", error);
        document.body.innerHTML = `<div class="p-4 bg-red-100 text-red-700"><strong>오류:</strong> ${error.message}. 파일들이 올바르게 같은 폴더에 있는지 확인해주세요.</div>`;
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
    if(!button) return;
    button.disabled = isLoading;
    const buttonText = button.querySelector('span');
    const buttonSpinner = button.querySelector('svg');
    if(buttonText) buttonText.classList.toggle('hidden', isLoading);
    if(buttonSpinner) buttonSpinner.classList.toggle('hidden', !isLoading);
}

function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if(modal) modal.classList.remove('hidden');
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if(modal) modal.classList.add('hidden');
}

// ===================================================================================
// 대시보드 (index.html) 관련 스크립트
// ===================================================================================
function initializeDashboard() {
    // ... 대시보드 관련 모든 함수 및 이벤트 리스너
}


// ===================================================================================
// 작업지시서 (work-order-form.html) 관련 스크립트
// ===================================================================================
function initializeWorkOrderForm() {
    // ... 작업지시서 관련 모든 함수 및 이벤트 리스너
}


// ===================================================================================
// 재고 입력 (stock-input.html) 관련 스크립트
// ===================================================================================
function initializeStockForm() {
    // ... 재고 입력 관련 모든 함수 및 이벤트 리스너
}


// ===================================================================================
// 공통 모달 관련 스크립트 (모든 페이지에서 작동)
// ===================================================================================
document.addEventListener('DOMContentLoaded', () => {
    document.body.addEventListener('click', e => {
        if (e.target.matches('.cancel-button')) {
            e.target.closest('.modal-template').classList.add('hidden');
        }
    });
});

