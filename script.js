// --- State Management ---
let inventory = [];
let withdrawHistory = [];
const LOW_STOCK_THRESHOLD = 5;

// --- Offline Queue (The Waiting Room) ---
let offlineQueue = JSON.parse(localStorage.getItem('offlineQueue')) || [];

// --- Server URLs ---
const API_URL = '/api/inventory';
const HISTORY_API_URL = '/api/history';

// --- DOM Elements ---
const form = document.getElementById('inventory-form');
const tableBody = document.getElementById('table-body');
const historyTableBody = document.getElementById('history-table-body');
const formTitle = document.getElementById('form-title');
const submitBtn = document.getElementById('submit-btn');
const cancelBtn = document.getElementById('cancel-btn');
const clearHistoryBtn = document.getElementById('clear-history-btn');
const offlineBanner = document.getElementById('offline-banner'); // NEW

// Form Inputs
const idInput = document.getElementById('item-id');
const nameInput = document.getElementById('item-name');
const skuInput = document.getElementById('item-sku');
const companyInput = document.getElementById('item-company');
const qtyInput = document.getElementById('item-qty');
const priceInput = document.getElementById('item-price');

// Filters & Dashboard
const searchInput = document.getElementById('search-input');
const companyFilter = document.getElementById('company-filter');
const totalItemsEl = document.getElementById('total-items');
const totalValueEl = document.getElementById('total-value');
const lowStockEl = document.getElementById('low-stock');

// Modal
const modal = document.getElementById('withdraw-modal');
const closeBtn = document.getElementById('close-modal');
const cancelWithdrawBtn = document.getElementById('cancel-withdraw-btn');
const withdrawForm = document.getElementById('withdraw-form');
const withdrawItemId = document.getElementById('withdraw-item-id');
const withdrawItemName = document.getElementById('withdraw-item-name');
const withdrawQty = document.getElementById('withdraw-qty');
const currentQtyDisplay = document.getElementById('current-qty-display');

// --- Functions ---

async function init() {
    // Check if we have offline data to sync first!
    if (navigator.onLine) {
        await syncOfflineData();
    } else {
        showOfflineState();
    }

    try {
        const invResponse = await fetch(API_URL);
        inventory = await invResponse.json();
        
        const histResponse = await fetch(HISTORY_API_URL);
        withdrawHistory = await histResponse.json();
        
        updateCompanyDropdown();
        renderTable();
        renderHistory();
        updateDashboard();
    } catch (error) {
        console.error("Error fetching data:", error);
        showOfflineState(); // If fetch fails, assume offline
    }
}

// --- NEW: Offline Sync Logic ---

// Listen for network changes
window.addEventListener('online', async () => {
    offlineBanner.classList.add('hidden');
    await syncOfflineData();
    await init(); // Refresh UI with official server data
    alert("Back online! Your offline changes have been synced.");
});

window.addEventListener('offline', showOfflineState);

function showOfflineState() {
    offlineBanner.classList.remove('hidden');
}

// Save request to localStorage queue
function queueOfflineRequest(url, method, bodyData) {
    offlineQueue.push({ url, method, bodyData });
    localStorage.setItem('offlineQueue', JSON.stringify(offlineQueue));
}

// Send all queued data to the server
async function syncOfflineData() {
    if (offlineQueue.length === 0) return;

    console.log(`Syncing ${offlineQueue.length} offline items...`);
    
    // Loop through the waiting room and send to server
    for (let request of offlineQueue) {
        try {
            await fetch(request.url, {
                method: request.method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(request.bodyData)
            });
        } catch (error) {
            console.error("Sync failed for an item", error);
        }
    }

    // Clear the queue after successful sync
    offlineQueue = [];
    localStorage.removeItem('offlineQueue');
}

// --- End Offline Logic ---

function updateCompanyDropdown() {
    const currentSelection = companyFilter.value;
    const uniqueCompanies = [...new Set(inventory.map(item => item.company).filter(c => c && c.trim() !== ''))];
    
    companyFilter.innerHTML = '<option value="">All Companies</option>';
    uniqueCompanies.forEach(company => {
        const option = document.createElement('option');
        option.value = company;
        option.textContent = company;
        companyFilter.appendChild(option);
    });
    
    if (uniqueCompanies.includes(currentSelection)) {
        companyFilter.value = currentSelection;
    }
}

function renderTable() {
    tableBody.innerHTML = '';
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    const selectedCompany = companyFilter.value;

    const filteredInventory = inventory.filter(item => {
        const matchName = item.name.toLowerCase().includes(searchTerm);
        const matchSku = item.sku && item.sku.toLowerCase().includes(searchTerm);
        const matchCompany = selectedCompany === '' || item.company === selectedCompany;
        return (matchName || matchSku) && matchCompany;
    });

    // --- NEW: Trigger scrollbar specifically at 50 items ---
    const tableContainer = document.querySelector('.table-responsive');
    if (filteredInventory.length >= 20) {
        tableContainer.classList.add('scroll-active');
    } else {
        tableContainer.classList.remove('scroll-active');
    }
    // --------------------------------------------------------

    if(filteredInventory.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;">No matching items found.</td></tr>`;
        return;
    }

    filteredInventory.forEach(item => {
        const isLowStock = item.qty <= LOW_STOCK_THRESHOLD;
        const statusClass = isLowStock ? 'status-low' : 'status-ok';
        const statusText = isLowStock ? 'Low Stock' : 'In Stock';
        const displaySku = item.sku ? `<strong>${item.sku}</strong>` : '-';
        const displayCompany = item.company || '-';
        const displayPrice = item.price ? `${parseFloat(item.price).toFixed(2)}` : '-';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${displaySku}</td>
            <td>${item.name}</td>
            <td>${displayCompany}</td>
            <td>${item.qty}</td>
            <td>${displayPrice}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td>
                <button class="btn btn-small btn-withdraw" onclick="openWithdrawModal('${item.id}')">Withdraw</button>
                <button class="btn btn-small btn-edit" onclick="editItem('${item.id}')">Edit</button>
                <button class="btn btn-small btn-delete" onclick="deleteItem('${item.id}')">Delete</button>
            </td>
        `;
        tableBody.appendChild(tr);
    });
}

function renderHistory() {
    historyTableBody.innerHTML = '';
    if(withdrawHistory.length === 0) {
        historyTableBody.innerHTML = `<tr><td colspan="4" style="text-align:center;">No recent withdrawals.</td></tr>`;
        return;
    }
    withdrawHistory.forEach(record => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${record.date}</td>
            <td>${record.itemName} ${record.company ? `(${record.company})` : ''}</td>
            <td>${record.itemSku || '-'}</td>
            <td style="color: var(--danger-color); font-weight: bold;">-${record.qty}</td>
        `;
        historyTableBody.appendChild(tr);
    });
}

function updateDashboard() {
    const totalItems = inventory.reduce((sum, item) => sum + parseInt(item.qty), 0);
    const totalValue = inventory.reduce((sum, item) => sum + (parseInt(item.qty) * (item.price ? parseFloat(item.price) : 0)), 0);
    const lowStockCount = inventory.filter(item => item.qty <= LOW_STOCK_THRESHOLD).length;

    totalItemsEl.textContent = totalItems;
    totalValueEl.textContent = `${totalValue.toFixed(2)}`;
    lowStockEl.textContent = lowStockCount;
}

// Updated Form Submit with Offline Check
form.addEventListener('submit', async function(e) {
    e.preventDefault();

    const itemData = {
        name: nameInput.value,
        sku: skuInput.value,
        company: companyInput.value,
        qty: parseInt(qtyInput.value),
        price: priceInput.value 
    };

    if (navigator.onLine) {
        // Online: Send directly to server
        try {
            if (idInput.value) {
                await fetch(`${API_URL}/${idInput.value}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(itemData)
                });
            } else {
                await fetch(API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(itemData)
                });
            }
            await init(); 
        } catch (error) { console.error(error); }
    } else {
        // Offline: Queue it up and fake the UI update
        const method = idInput.value ? 'PUT' : 'POST';
        const url = idInput.value ? `${API_URL}/${idInput.value}` : API_URL;
        
        queueOfflineRequest(url, method, itemData);
        
        // Optimistically update the local array so the user sees their change instantly
        if (!idInput.value) {
            itemData.id = 'temp-' + Date.now(); // Temp ID
            inventory.push(itemData);
        } else {
            itemData.id = idInput.value;
            inventory = inventory.map(item => item.id === itemData.id ? itemData : item);
        }
        
        updateCompanyDropdown();
        renderTable();
        updateDashboard();
    }

    form.reset();
    resetFormState();
});

window.deleteItem = async function(id) {
    if(confirm('Are you sure you want to delete this item?')) {
        if(navigator.onLine) {
            await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
            await init();
        } else {
            queueOfflineRequest(`${API_URL}/${id}`, 'DELETE', null);
            inventory = inventory.filter(item => item.id !== id);
            renderTable();
            updateDashboard();
        }
    }
}

window.editItem = function(id) {
    const item = inventory.find(item => item.id === id);
    if(!item) return;

    idInput.value = item.id;
    nameInput.value = item.name;
    skuInput.value = item.sku || ''; 
    companyInput.value = item.company || ''; 
    qtyInput.value = item.qty;
    priceInput.value = item.price || ''; 

    formTitle.textContent = 'Edit Item';
    submitBtn.textContent = 'Update Item';
    cancelBtn.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

cancelBtn.addEventListener('click', () => { form.reset(); resetFormState(); });

function resetFormState() {
    idInput.value = '';
    formTitle.textContent = 'Add New Item';
    submitBtn.textContent = 'Add to Inventory';
    cancelBtn.classList.add('hidden');
}

clearHistoryBtn.addEventListener('click', async () => {
    if(confirm('Are you sure you want to clear the withdrawal history?')) {
        if(navigator.onLine) {
            await fetch(HISTORY_API_URL, { method: 'DELETE' });
            await init();
        } else {
            queueOfflineRequest(HISTORY_API_URL, 'DELETE', null);
            withdrawHistory = [];
            renderHistory();
        }
    }
});

searchInput.addEventListener('input', renderTable);
companyFilter.addEventListener('change', renderTable);

window.openWithdrawModal = function(id) {
    const item = inventory.find(i => i.id === id);
    if(!item) return;
    withdrawItemId.value = item.id;
    withdrawItemName.textContent = `Item: ${item.name}`;
    currentQtyDisplay.textContent = `Current Stock Available: ${item.qty}`;
    withdrawQty.max = item.qty;
    withdrawQty.value = ''; 
    modal.classList.remove('hidden');
};

function closeModal() { modal.classList.add('hidden'); withdrawForm.reset(); }
closeBtn.addEventListener('click', closeModal);
cancelWithdrawBtn.addEventListener('click', closeModal);
window.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

// Updated Withdraw Submit with Offline Check
withdrawForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const id = withdrawItemId.value;
    const amountToWithdraw = parseInt(withdrawQty.value);
    const itemIndex = inventory.findIndex(i => i.id === id);
    if(itemIndex === -1) return;

    if(amountToWithdraw > inventory[itemIndex].qty) {
        alert("Error: You cannot withdraw more than the current stock available!");
        return;
    }

    const updatedItem = { ...inventory[itemIndex] };
    updatedItem.qty -= amountToWithdraw;

    const record = {
        date: new Date().toLocaleString(),
        itemName: inventory[itemIndex].name,
        itemSku: inventory[itemIndex].sku,
        company: inventory[itemIndex].company,
        qty: amountToWithdraw
    };

    if (navigator.onLine) {
        try {
            await fetch(`${API_URL}/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedItem)
            });
            await fetch(HISTORY_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(record)
            });
            await init(); 
        } catch (error) { console.error("Error withdrawing:", error); }
    } else {
        // Queue offline
        queueOfflineRequest(`${API_URL}/${id}`, 'PUT', updatedItem);
        queueOfflineRequest(HISTORY_API_URL, 'POST', record);
        
        // Update local arrays optimistically
        inventory[itemIndex].qty = updatedItem.qty;
        withdrawHistory.unshift(record);
        
        renderTable();
        renderHistory();
        updateDashboard();
    }
    
    closeModal();
});

init();