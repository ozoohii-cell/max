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
        
        const affiliatedWrapper = document.getElementById('affiliated-company-wrapper');
        if(affiliatedWrapper) affiliatedWrapper.classList.add('hidden');
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
            errors.forEach(result => console.error(result.error));
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
                    allData.announcements = allData.announcements.filter(a => a.id != id);
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
            const { data, error } = await supabaseClient.from('todos').insert({ task: task }).select().single();
            if (error) {
                showNotification('할 일 추가 실패: ' + error.message, 'error');
            } else {
                input.value = '';
                allData.todos.push(data);
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
                allData.todos = allData.todos.filter(t => t.id != id);
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
                e.target.checked = !is_completed;
            } else {
                const todo = allData.todos.find(t => t.id == id);
                if(todo) todo.is_completed = is_completed;
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
        customerSearchInput.addEventListener('input', () => {
             const value = customerSearchInput.value.toLowerCase();
             customerSuggestionsContainer.innerHTML = '';
             if (!value) { customerSuggestionsContainer.classList.add('hidden'); return; }
             const filtered = allData.customers.filter(c => c.customer_name.toLowerCase().includes(value));
             filtered.forEach(customer => {
                 const div = document.createElement('div');
                 div.className = 'p-2 hover:bg-slate-100 cursor-pointer';
                 div.textContent = `${customer.customer_name} (${customer.phone_number || '연락처 없음'})`;
                 div.addEventListener('click', () => {
                     customerSearchInput.value = customer.customer_name;
                     customerIdInput.value = customer.customer_id;
                     selectedCustomer = customer;
                     customerSuggestionsContainer.classList.add('hidden');
                 });
                 customerSuggestionsContainer.appendChild(div);
             });
             customerSuggestionsContainer.classList.toggle('hidden', filtered.length === 0);
        });

        carSearchInput.addEventListener('input', () => {
             const value = carSearchInput.value.toLowerCase();
             carSuggestionsContainer.innerHTML = '';
             if (!value) { carSuggestionsContainer.classList.add('hidden'); return; }
             const filtered = allData.cars.filter(c => c.car_plate_number.toLowerCase().includes(value));
             filtered.forEach(car => {
                 const div = document.createElement('div');
                 div.className = 'p-2 hover:bg-slate-100 cursor-pointer';
                 div.textContent = `${car.car_plate_number} (${car.car_model || '차종 미입력'})`;
                 div.addEventListener('click', () => {
                     carSearchInput.value = car.car_plate_number;
                     carIdInput.value = car.car_id;
                     selectedCarModelText.textContent = `차종: ${car.car_model || '미입력'}`;
                     carSuggestionsContainer.classList.add('hidden');
                 });
                 carSuggestionsContainer.appendChild(div);
             });
             carSuggestionsContainer.classList.toggle('hidden', filtered.length === 0);
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
                const detailId = `service-detail-block-${item.service_category_id}`;
                if (isActive) {
                    const block = document.createElement('div');
                    block.id = detailId;
                    block.className = "p-3 border rounded-lg";
                    block.innerHTML = `
                        <div class="flex justify-between items-center mb-2">
                            <h4 class="font-bold">${item.service_name}</h4>
                            <div class="flex gap-2">
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
                } else {
                    document.getElementById(detailId)?.remove();
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
        // ... (rest of the function is implemented below)
        wrapper.appendChild(row);
    }
    
    // ... (rest of the functions need to be here)

    // Initial setup
    populateServiceChips(allData.serviceCategories);
    setupAllAutocompletes();
    setupModalEventListeners();

    // Event Listeners
    document.getElementById('add-customer-button').addEventListener('click', () => showModal('customer-modal'));
    document.getElementById('add-car-button').addEventListener('click', () => showModal('car-modal'));
    discountAmountInput.addEventListener('input', calculateFinalAmount);
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
            const button = e.target.querySelector('button[type="submit"]');
            setLoading(button, true);
            const { error } = await supabaseClient.from('announcements').insert({ content: content });
            setLoading(button, false);
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
        const button = e.target.querySelector('button[type="submit"]');
        setLoading(button, true);

        const formData = new FormData(e.target);
        const customerData = Object.fromEntries(formData.entries());
        if (!customerData.affiliated_company_id) {
            customerData.affiliated_company_id = null;
        }

        const { data, error } = await supabaseClient.from('customers').insert(customerData).select().single();
        
        setLoading(button, false);
        if (error) {
            showNotification(`고객 등록 실패: ${error.message}`, 'error');
        } else {
            showNotification('신규 고객이 등록되었습니다.');
            hideModal('customer-modal');
            allData.customers.push(data);
            
            const customerSearchInput = document.getElementById('customer-search');
            if(customerSearchInput) {
                customerSearchInput.value = data.customer_name;
                document.getElementById('customer_id').value = data.customer_id;
                selectedCustomer = data;
            }
        }
    });

    // Car Modal
    document.getElementById('new-car-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const button = e.target.querySelector('button[type="submit"]');
        setLoading(button, true);

        const formData = new FormData(e.target);
        const carData = Object.fromEntries(formData.entries());

        const { data, error } = await supabaseClient.from('cars').insert(carData).select().single();

        setLoading(button, false);
        if (error) {
            showNotification(`차량 등록 실패: ${error.message}`, 'error');
        } else {
            showNotification('신규 차량이 등록되었습니다.');
            hideModal('car-modal');
            allData.cars.push(data);

            const carSearchInput = document.getElementById('car-search');
            if(carSearchInput) {
                carSearchInput.value = data.car_plate_number;
                document.getElementById('car_id').value = data.car_id;
                document.getElementById('selected-car-model').textContent = `차종: ${data.car_model || '미입력'}`;
            }
        }
    });
    
    // Customer Modal - Group Type Change
    document.getElementById('new_group_type')?.addEventListener('change', (e) => {
        const affiliatedWrapper = document.getElementById('affiliated-company-wrapper');
        const selectedValue = e.target.value;
        if (['회사', '신차카마스터', '중고차카마스터'].includes(selectedValue)) {
            affiliatedWrapper.classList.remove('hidden');
        } else {
            affiliatedWrapper.classList.add('hidden');
        }
    });
    
    // affiliated-company-search autocomplete
    const affiliatedCompanySearchInput = document.getElementById('affiliated-company-search');
    const affiliatedCompanySuggestions = document.getElementById('affiliated-company-suggestions');
    const affiliatedCompanyIdInput = document.getElementById('affiliated_company_id');
    affiliatedCompanySearchInput?.addEventListener('input', () => {
        const value = affiliatedCompanySearchInput.value.toLowerCase();
        affiliatedCompanySuggestions.innerHTML = '';
        if(!value) { affiliatedCompanySuggestions.classList.add('hidden'); return; }
        const filtered = allData.affiliatedCompanies.filter(c => c.company_name.toLowerCase().includes(value));
        filtered.forEach(company => {
            const div = document.createElement('div');
            div.className = 'p-2 hover:bg-slate-100 cursor-pointer';
            div.textContent = company.company_name;
            div.addEventListener('click', () => {
                affiliatedCompanySearchInput.value = company.company_name;
                affiliatedCompanyIdInput.value = company.company_id;
                affiliatedCompanySuggestions.classList.add('hidden');
            });
            affiliatedCompanySuggestions.appendChild(div);
        });
        affiliatedCompanySuggestions.classList.toggle('hidden', filtered.length === 0);
    });

    // car-model-search autocomplete
    const carModelInput = document.getElementById('new_car_model');
    const carModelSuggestions = document.getElementById('car-model-suggestions');
    carModelInput?.addEventListener('input', () => {
        const value = carModelInput.value.toLowerCase();
        carModelSuggestions.innerHTML = '';
        if(!value) { carModelSuggestions.classList.add('hidden'); return; }
        const filtered = allData.carNames.filter(name => name.toLowerCase().includes(value));
        filtered.slice(0, 10).forEach(name => {
            const div = document.createElement('div');
            div.className = 'p-2 hover:bg-slate-100 cursor-pointer';
            div.textContent = name;
            div.addEventListener('click', () => {
                carModelInput.value = name;
                carModelSuggestions.classList.add('hidden');
            });
            carModelSuggestions.appendChild(div);
        });
        carModelSuggestions.classList.toggle('hidden', filtered.length === 0);
    });


    // Cancel buttons
    document.querySelectorAll('.cancel-button').forEach(button => {
        button.addEventListener('click', () => {
            const modal = button.closest('.modal-template');
            if(modal) hideModal(modal.id);
        });
    });
}
