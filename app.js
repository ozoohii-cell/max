// ===================================================================================
// ✨ SUPABASE 설정
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
    prefixes: [],
    announcements: [],
    todos: []
};

// 현재 페이지 상태
let selectedCustomer = null;
let currentEditingOrder = null;
let activeItemEntryRow = null; 

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
        
    } catch (error) {
        console.error("공통 컴포넌트 로딩 실패:", error);
        document.body.innerHTML = `<div class="p-4 bg-red-100 text-red-700"><strong>오류:</strong> ${error.message}.</div>`;
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
    }
}

async function loadInitialData() {
    try {
        const results = await Promise.all([
            supabaseClient.from('customers').select('*'),
            supabaseClient.from('cars').select('*'),
            supabaseClient.from('service_categories').select('*'),
            supabaseClient.from('service_items').select('*'),
            supabaseClient.from('affiliated_companies').select('*'),
            supabaseClient.from('car_name').select('car_name'),
            supabaseClient.from('suppliers').select('*'),
            supabaseClient.from('serial_number_prefixes').select('*'),
            supabaseClient.from('announcements').select('*').order('created_at', { ascending: false }),
            supabaseClient.from('todos').select('*').order('created_at', { ascending: true })
        ]);
        
        const errors = results.filter(result => result.error);
        if (errors.length > 0) {
            errors.forEach(error => console.error(error.error));
            throw new Error('데이터를 불러오는 중 오류가 발생했습니다.');
        }

        allData = {
            customers: results[0].data,
            cars: results[1].data,
            serviceCategories: results[2].data,
            serviceItems: results[3].data,
            affiliatedCompanies: results[4].data,
            carNames: results[5].data.map(c => c.car_name),
            suppliers: results[6].data,
            prefixes: results[7].data,
            announcements: results[8].data,
            todos: results[9].data
        };

    } catch(error) {
        console.error('초기 데이터 로딩 실패:', error);
        showNotification('데이터 로딩에 실패했습니다.', 'error');
    }
}


// ===================================================================================
// 대시보드 (index.html) 관련 스크립트
// ===================================================================================
async function initializeDashboard() {
    setupModalEventListeners();
    
    renderAnnouncements();
    renderTodos();

    document.getElementById('add-announcement-button').addEventListener('click', () => {
        showModal('announcement-modal');
    });

    document.getElementById('view-all-announcements-button').addEventListener('click', () => {
        renderAllAnnouncementsModal();
        showModal('announcements-history-modal');
    });
    
    document.getElementById('view-all-todos-button').addEventListener('click', () => {
        renderAllTodosModal();
        showModal('todos-history-modal');
    });

    document.getElementById('announcements-list').addEventListener('click', async (e) => {
        if (e.target.closest('.delete-announcement-btn')) {
            const id = e.target.closest('.delete-announcement-btn').dataset.id;
            if (confirm('정말로 이 공지를 삭제하시겠습니까?')) {
                const { error } = await supabaseClient.from('announcements').delete().eq('id', id);
                if (error) {
                    showNotification('삭제 실패: ' + error.message, 'error');
                } else {
                    showNotification('공지가 삭제되었습니다.');
                    await loadInitialData();
                    renderAnnouncements();
                }
            }
        }
    });

    document.getElementById('new-todo-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('new-todo-input');
        const task = input.value.trim();
        if (task) {
            const { error } = await supabaseClient.from('todos').insert({ task: task });
            if (error) {
                showNotification('할 일 추가 실패: ' + error.message, 'error');
            } else {
                input.value = '';
                await loadInitialData();
                renderTodos();
            }
        }
    });

    document.getElementById('todos-list').addEventListener('click', async (e) => {
        if (e.target.closest('.delete-todo-btn')) {
            const id = e.target.closest('.delete-todo-btn').dataset.id;
            const { error } = await supabaseClient.from('todos').delete().eq('id', id);
            if (error) {
                showNotification('삭제 실패: ' + error.message, 'error');
            } else {
                await loadInitialData();
                renderTodos();
            }
        }
    });
    
    document.getElementById('todos-list').addEventListener('change', async (e) => {
        if (e.target.matches('input[type="checkbox"]')) {
            const id = e.target.dataset.id;
            const is_completed = e.target.checked;
            const { error } = await supabaseClient.from('todos').update({ is_completed }).eq('id', id);
            if (error) {
                showNotification('상태 업데이트 실패: ' + error.message, 'error');
            } else {
                await loadInitialData();
                renderTodos();
            }
        }
    });
}

function renderAnnouncements() {
    const list = document.getElementById('announcements-list');
    list.innerHTML = '';
    const announcementsToShow = allData.announcements.slice(0, 5);
    if (announcementsToShow.length === 0) {
        list.innerHTML = `<li>등록된 공지사항이 없습니다.</li>`;
        return;
    }
    announcementsToShow.forEach(item => {
        const li = document.createElement('li');
        li.className = 'flex justify-between items-center';
        li.innerHTML = `
            <span>- ${item.content}</span>
            <button data-id="${item.id}" class="delete-announcement-btn text-red-400 hover:text-red-600 text-xs">삭제</button>
        `;
        list.appendChild(li);
    });
}

function renderTodos() {
    const list = document.getElementById('todos-list');
    list.innerHTML = '';
    const incompleteTodos = allData.todos.filter(todo => !todo.is_completed);
     if (incompleteTodos.length === 0) {
        list.innerHTML = `<li class="text-slate-500">완료할 항목이 없습니다.</li>`;
        return;
    }
    incompleteTodos.forEach(item => {
        const li = document.createElement('li');
        li.className = 'flex items-center justify-between';
        li.innerHTML = `
            <div class="flex items-center">
                <input type="checkbox" data-id="${item.id}" class="h-4 w-4 rounded mr-2" ${item.is_completed ? 'checked' : ''}>
                <span class="${item.is_completed ? 'line-through text-slate-400' : ''}">${item.task}</span>
            </div>
            <button data-id="${item.id}" class="delete-todo-btn text-red-400 hover:text-red-600 text-xs">삭제</button>
        `;
        list.appendChild(li);
    });
}

function renderAllAnnouncementsModal() {
    const list = document.getElementById('all-announcements-list');
    list.innerHTML = '';
    if (allData.announcements.length === 0) {
        list.innerHTML = `<li>등록된 공지사항이 없습니다.</li>`;
        return;
    }
    allData.announcements.forEach(item => {
        const li = document.createElement('li');
        li.className = 'py-1';
        li.innerHTML = `- ${item.content} <span class="text-xs text-slate-400 ml-2">${new Date(item.created_at).toLocaleDateString()}</span>`;
        list.appendChild(li);
    });
}

function renderAllTodosModal() {
    const list = document.getElementById('all-todos-list');
    list.innerHTML = '';
    if (allData.todos.length === 0) {
        list.innerHTML = `<li class="text-slate-500">등록된 할 일이 없습니다.</li>`;
        return;
    }
    allData.todos.forEach(item => {
        const li = document.createElement('li');
        li.className = 'py-1';
        li.innerHTML = `
            <span class="${item.is_completed ? 'line-through text-slate-400' : ''}">${item.task}</span>
            <span class="text-xs text-slate-400 ml-2">${new Date(item.created_at).toLocaleDateString()}</span>
        `;
        list.appendChild(li);
    });
}

// ===================================================================================
// ✨ 작업지시서 (work-order-form.html) 관련 스크립트
// ===================================================================================
async function initializeWorkOrderForm() {
    const form = document.getElementById('work-order-form');
    const workOrderList = document.getElementById('work-order-list');
    const listLoader = document.getElementById('list-loader');
    const totalAmountInput = document.getElementById('total_amount');
    const discountAmountInput = document.getElementById('discount_amount');
    const finalAmountInput = document.getElementById('final_amount');
    const customerSearchInput = document.getElementById('customer-search');
    const customerSuggestionsContainer = document.getElementById('customer-suggestions');
    const customerIdInput = document.getElementById('customer_id');
    const carSearchInput = document.getElementById('car-search');
    const carSuggestionsContainer = document.getElementById('car-suggestions');
    const carIdInput = document.getElementById('car_id');
    const selectedCarModelText = document.getElementById('selected-car-model');
    const serviceDetailsContainer = document.getElementById('service-details-container');
    const editingWorkOrderIdInput = document.getElementById('editing_work_order_id');
    const newFormButton = document.getElementById('new-form-button');
    const paymentDetails = document.getElementById('payment-details');
    const createModeContainer = document.getElementById('create-mode-container');
    const editModeContainer = document.getElementById('edit-mode-container');
    const paymentButton = document.getElementById('payment-button');
    
    function setupAllAutocompletes() {
        // Customer search
        customerSearchInput.addEventListener('input', () => {
             const value = customerSearchInput.value.toLowerCase();
             customerSuggestionsContainer.innerHTML = '';
             if (!value) {
                 customerSuggestionsContainer.classList.add('hidden');
                 return;
             }
             const filtered = allData.customers.filter(c => c.customer_name.toLowerCase().includes(value));
             if (filtered.length > 0) {
                 filtered.forEach(customer => {
                     const div = document.createElement('div');
                     div.className = 'p-2 hover:bg-slate-100 cursor-pointer';
                     div.textContent = customer.customer_name;
                     div.addEventListener('click', () => {
                         customerSearchInput.value = customer.customer_name;
                         customerIdInput.value = customer.customer_id;
                         selectedCustomer = customer;
                         customerSuggestionsContainer.classList.add('hidden');
                     });
                     customerSuggestionsContainer.appendChild(div);
                 });
                 customerSuggestionsContainer.classList.remove('hidden');
             } else {
                 customerSuggestionsContainer.classList.add('hidden');
             }
        });

        // Car search
        carSearchInput.addEventListener('input', () => {
             const value = carSearchInput.value.toLowerCase();
             carSuggestionsContainer.innerHTML = '';
             if (!value) {
                 carSuggestionsContainer.classList.add('hidden');
                 return;
             }
             const filtered = allData.cars.filter(c => c.car_plate_number.toLowerCase().includes(value));
             if (filtered.length > 0) {
                 filtered.forEach(car => {
                     const div = document.createElement('div');
                     div.className = 'p-2 hover:bg-slate-100 cursor-pointer';
                     div.textContent = car.car_plate_number;
                     div.addEventListener('click', () => {
                         carSearchInput.value = car.car_plate_number;
                         carIdInput.value = car.car_id;
                         selectedCarModelText.textContent = `차종: ${car.car_model || '미입력'}`;
                         carSuggestionsContainer.classList.add('hidden');
                     });
                     carSuggestionsContainer.appendChild(div);
                 });
                 carSuggestionsContainer.classList.remove('hidden');
             } else {
                 carSuggestionsContainer.classList.add('hidden');
             }
        });
    }

    function updateTotalAmount() {
        let total = 0;
        document.querySelectorAll('.applied_price').forEach(input => {
            total += parseFloat(input.value) || 0;
        });
        totalAmountInput.value = total;
        calculateFinalAmount();
    }
    
    function calculateFinalAmount() {
        const total = parseFloat(totalAmountInput.value) || 0;
        const discount = parseFloat(discountAmountInput.value) || 0;
        finalAmountInput.value = total - discount;
    }
    
    function populateServiceChips(data) {
        const container = document.getElementById('services-chips-container');
        if(!container) return;
        container.innerHTML = '';
        data.forEach(item => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'px-3 py-1.5 border border-slate-300 rounded-full text-sm font-medium text-slate-700 hover:bg-slate-100 transition';
            chip.textContent = item.service_name;
            chip.dataset.serviceCategoryId = item.service_category_id;
            chip.addEventListener('click', () => {
                const isActive = chip.classList.toggle('bg-blue-600');
                chip.classList.toggle('text-white');
                chip.classList.toggle('border-blue-600');
                const detailId = `service-detail-block-${item.service_category_id}`;
                if (isActive) {
                    const block = document.createElement('div');
                    block.id = detailId;
                    block.className = "p-3 border rounded-lg";
                    block.innerHTML = `
                        <div class="flex justify-between items-center mb-2">
                            <h4 class="font-bold">${item.service_name}</h4>
                            <div class="flex gap-2">
                                <button type="button" class="create-service-item-button text-sm bg-green-100 text-green-700 px-2 py-1 rounded-md hover:bg-green-200" data-category-id="${item.service_category_id}" data-category-name="${item.service_name}">상세항목추가</button>
                                <button type="button" class="add-service-item-button text-sm bg-blue-100 text-blue-700 px-2 py-1 rounded-md hover:bg-blue-200" data-category-id="${item.service_category_id}">+ 항목추가</button>
                            </div>
                        </div>
                        <div class="service-items-wrapper space-y-2"></div>
                    `;
                    serviceDetailsContainer.appendChild(block);
                    addNewServiceItemRow(block.querySelector('.service-items-wrapper'), item.service_category_id);
                    block.querySelector('.add-service-item-button').addEventListener('click', (e) => {
                        addNewServiceItemRow(block.querySelector('.service-items-wrapper'), e.target.dataset.categoryId);
                    });
                     block.querySelector('.create-service-item-button').addEventListener('click', (e) => {
                        const categoryId = e.target.dataset.categoryId;
                        const categoryName = e.target.dataset.categoryName;
                        document.getElementById('service-item-modal-title').textContent = `신규 상세 작업 항목 추가 (${categoryName})`;
                        document.getElementById('new_item_category_id').value = categoryId;
                        showModal('service-item-modal');
                    });
                } else {
                    const block = document.getElementById(detailId);
                    if (block) serviceDetailsContainer.removeChild(block);
                }
                updateTotalAmount();
            });
            container.appendChild(chip);
        });
    }

    function addNewServiceItemRow(wrapper, categoryId) {
        const templateNode = document.getElementById('service-item-template-content');
        if(!templateNode) return;
        const templateContent = templateNode.content.cloneNode(true);
        const row = templateContent.querySelector('.service-item-row');
        const searchInput = row.querySelector('.service-item-search');
        const idInput = row.querySelector('.service_item_id');
        const priceInput = row.querySelector('.applied_price');
        const suggestionsContainer = row.querySelector('.service-item-suggestions');

        searchInput.addEventListener('input', () => {
             const value = searchInput.value.toLowerCase();
             const categoryItems = allData.serviceItems.filter(i => i.service_category_id == categoryId);
             suggestionsContainer.innerHTML = '';
             if (!value) { suggestionsContainer.classList.add('hidden'); return; }
             const filtered = categoryItems.filter(i => i.item_name.toLowerCase().includes(value));
             if (filtered.length > 0) {
                 filtered.forEach(item => {
                     const div = document.createElement('div');
                     div.className = 'p-2 hover:bg-slate-100 cursor-pointer';
                     div.textContent = item.item_name;
                     div.addEventListener('click', () => {
                         searchInput.value = item.item_name;
                         idInput.value = item.item_id;
                         if (selectedCustomer) {
                             const group = selectedCustomer.group_type;
                             let price = item.price_a;
                             if (group === '회사') price = item.price_b;
                             if (group === '신차카마스터' || group === '중고차카마스터') price = item.price_c;
                             priceInput.value = price;
                         } else {
                             priceInput.value = item.price_a;
                         }
                         suggestionsContainer.classList.add('hidden');
                         updateTotalAmount();
                     });
                     suggestionsContainer.appendChild(div);
                 });
                 suggestionsContainer.classList.remove('hidden');
             }
        });

        priceInput.addEventListener('input', updateTotalAmount);
        row.querySelector('.remove-service-item-button').addEventListener('click', () => {
            row.remove();
            updateTotalAmount();
        });

        wrapper.appendChild(row);
    }
    
    async function fetchWorkOrders() {
        listLoader.classList.remove('hidden');
        workOrderList.innerHTML = '';
        const { data, error } = await supabaseClient
            .from('work_orders')
            .select(`*, customers(*), cars(*)`)
            .order('in_date', { ascending: false });

        listLoader.classList.add('hidden');
        if (error) {
            showNotification('작업 목록 로딩 실패', 'error');
            return;
        }

        if (data.length > 0) {
            data.forEach(order => {
                const div = document.createElement('div');
                div.className = 'bg-white p-4 rounded-lg shadow cursor-pointer';
                div.innerHTML = `<h3>${order.customers.customer_name} - ${order.cars.car_plate_number}</h3>`;
                div.addEventListener('click', () => loadWorkOrderForEditing(order.work_order_id));
                workOrderList.appendChild(div);
            });
        } else {
            workOrderList.innerHTML = '<p>작업 내역이 없습니다.</p>';
        }
    }

    async function loadWorkOrderForEditing(orderId) {
        // ... implementation needed
    }

    // --- Initial setup ---
    populateServiceChips(allData.serviceCategories);
    await fetchWorkOrders();
    setupAllAutocompletes();
    setupModalEventListeners();

    // --- Event Listeners ---
    document.getElementById('add-customer-button').addEventListener('click', () => showModal('customer-modal'));
    document.getElementById('add-car-button').addEventListener('click', () => showModal('car-modal'));
    discountAmountInput.addEventListener('input', calculateFinalAmount);
    // ... other listeners
}


// ===================================================================================
// 공통 모달 및 이벤트 리스너
// ===================================================================================
function setupModalEventListeners() {
    // Announcement Modal
    document.getElementById('new-announcement-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const content = document.getElementById('new_announcement_content').value.trim();
        if (content) {
            setLoading(e.target.querySelector('button[type="submit"]'), true);
            const { error } = await supabaseClient.from('announcements').insert({ content: content });
            setLoading(e.target.querySelector('button[type="submit"]'), false);
            if (error) {
                showNotification('공지 등록 실패: ' + error.message, 'error');
            } else {
                showNotification('공지가 등록되었습니다.');
                hideModal('announcement-modal');
                await loadInitialData();
                renderAnnouncements();
            }
        }
    });

    // Customer Modal
    document.getElementById('new-customer-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        // ... logic to save new customer ...
        showNotification('신규 고객이 등록되었습니다.');
        hideModal('customer-modal');
        await loadInitialData(); // Refresh data
    });

    // Car Modal
    document.getElementById('new-car-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        // ... logic to save new car ...
        showNotification('신규 차량이 등록되었습니다.');
        hideModal('car-modal');
        await loadInitialData(); // Refresh data
    });
    
    // Service Item Modal
     document.getElementById('new-service-item-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        // ... logic to save new service item ...
        showNotification('신규 상세항목이 등록되었습니다.');
        hideModal('service-item-modal');
        await loadInitialData(); // Refresh data
    });

    // Cancel buttons
    document.querySelectorAll('.cancel-button').forEach(button => {
        button.addEventListener('click', () => {
            const modal = button.closest('.modal-template');
            if(modal) hideModal(modal.id);
        });
    });
}