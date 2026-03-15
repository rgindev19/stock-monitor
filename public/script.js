// --- State Management ---
let inventory = [];
let withdrawHistory = [];
const LOW_STOCK_THRESHOLD = 5;

// --- Server URLs ---
const API_URL = '/api/inventory';
const HISTORY_API_URL = '/api/history';

// --- DOM Elements ---
// Main Form
const form = document.getElementById('inventory-form');
const tableBody = document.getElementById('table-body');
const historyTableBody = document.getElementById('history-table-body');
const formTitle = document.getElementById('form-title');
const submitBtn = document.getElementById('submit-btn');
const cancelBtn = document.getElementById('cancel-btn');
const clearHistoryBtn = document.getElementById('clear-history-btn');

// Form Inputs
const idInput = document.getElementById('item-id');
const nameInput = document.getElementById('item-name');
const skuInput = document.getElementById('item-sku');
const qtyInput = document.getElementById('item-qty');
const priceInput = document.getElementById('item-price');

// Dashboard & Search Elements
const totalItemsEl = document.getElementById('total-items');
const totalValueEl = document.getElementById('total-value');
const lowStockEl = document.getElementById('low-stock');
const searchInput = document.getElementById('search-input');

// Modal Elements
const modal = document.getElementById('withdraw-modal');
const closeBtn = document.getElementById('close-modal');
const cancelWithdrawBtn = document.getElementById('cancel-withdraw-btn');
const withdrawForm = document.getElementById('withdraw-form');
const withdrawItemId = document.getElementById('withdraw-item-id');
const withdrawItemName = document.getElementById('withdraw-item-name');
const withdrawQty = document.getElementById('withdraw-qty');
const currentQtyDisplay = document.getElementById('current-qty-display');

// --- Functions ---

// 1. Initialize App (Fetch from Server)
async function init() {
    try {
        // Fetch inventory
        const invResponse = await fetch(API_URL);
        inventory = await invResponse.json();
        
        // Fetch history
        const histResponse = await fetch(HISTORY_API_URL);
        withdrawHistory = await histResponse.json();
        
        renderTable();
        renderHistory();
        updateDashboard();
    } catch (error) {
        console.error("Error fetching data from server:", error);
    }
}

// 2. Render Table Data
function renderTable() {
    tableBody.innerHTML = '';
    
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';

    const filteredInventory = inventory.filter(item => {
        const matchName = item.name.toLowerCase().includes(searchTerm);
        const matchSku = item.sku && item.sku.toLowerCase().includes(searchTerm);
        return matchName || matchSku;
    });

    if(filteredInventory.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No matching items found.</td></tr>`;
        return;
    }

    filteredInventory.forEach(item => {
        const isLowStock = item.qty <= LOW_STOCK_THRESHOLD;
        const statusClass = isLowStock ? 'status-low' : 'status-ok';
        const statusText = isLowStock ? 'Low Stock' : 'In Stock';

        const displaySku = item.sku ? `<strong>${item.sku}</strong>` : '-';
        const displayPrice = item.price ? `${parseFloat(item.price).toFixed(2)}` : '-';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${displaySku}</td>
            <td>${item.name}</td>
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

// 3. Render History Table Data
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
            <td>${record.itemName}</td>
            <td>${record.itemSku || '-'}</td>
            <td style="color: var(--danger-color); font-weight: bold;">-${record.qty}</td>
        `;
        historyTableBody.appendChild(tr);
    });
}

// 4. Update Dashboard Widgets
function updateDashboard() {
    const totalItems = inventory.reduce((sum, item) => sum + parseInt(item.qty), 0);
    
    const totalValue = inventory.reduce((sum, item) => {
        const itemPrice = item.price ? parseFloat(item.price) : 0;
        return sum + (parseInt(item.qty) * itemPrice);
    }, 0);

    const lowStockCount = inventory.filter(item => item.qty <= LOW_STOCK_THRESHOLD).length;

    totalItemsEl.textContent = totalItems;
    totalValueEl.textContent = `${totalValue.toFixed(2)}`;
    lowStockEl.textContent = lowStockCount;
}

// 5. Handle Form Submit (Add or Update via Server)
form.addEventListener('submit', async function(e) {
    e.preventDefault();

    const itemData = {
        name: nameInput.value,
        sku: skuInput.value,
        qty: parseInt(qtyInput.value),
        price: priceInput.value 
    };

    try {
        if (idInput.value) {
            // UPDATE existing item (PUT request)
            await fetch(`${API_URL}/${idInput.value}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(itemData)
            });
        } else {
            // ADD new item (POST request)
            await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(itemData)
            });
        }

        // Refresh data from server
        await init(); 
        form.reset();
        resetFormState();
    } catch (error) {
        console.error("Error saving item:", error);
    }
});

// 6. Delete Item (via Server)
// (Attached to window so the HTML onclick="" can access it)
window.deleteItem = async function(id) {
    if(confirm('Are you sure you want to delete this item?')) {
        try {
            await fetch(`${API_URL}/${id}`, {
                method: 'DELETE'
            });
            await init(); // Refresh data
        } catch (error) {
            console.error("Error deleting item:", error);
        }
    }
}

// 7. Edit Item (Populate Form)
window.editItem = function(id) {
    const item = inventory.find(item => item.id === id);
    if(!item) return;

    idInput.value = item.id;
    nameInput.value = item.name;
    skuInput.value = item.sku || ''; 
    qtyInput.value = item.qty;
    priceInput.value = item.price || ''; 

    formTitle.textContent = 'Edit Item';
    submitBtn.textContent = 'Update Item';
    cancelBtn.classList.remove('hidden');
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 8. Cancel Edit
cancelBtn.addEventListener('click', () => {
    form.reset();
    resetFormState();
});

function resetFormState() {
    idInput.value = '';
    formTitle.textContent = 'Add New Item';
    submitBtn.textContent = 'Add to Inventory';
    cancelBtn.classList.add('hidden');
}

// 9. Clear History (via Server)
clearHistoryBtn.addEventListener('click', async () => {
    if(confirm('Are you sure you want to clear the withdrawal history?')) {
        try {
            await fetch(HISTORY_API_URL, {
                method: 'DELETE'
            });
            await init(); // Refresh data
        } catch (error) {
            console.error("Error clearing history:", error);
        }
    }
});

// 10. Search Functionality Listener
searchInput.addEventListener('input', renderTable);


// --- Modal & Withdrawal Logic ---

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

function closeModal() {
    modal.classList.add('hidden');
    withdrawForm.reset();
}

closeBtn.addEventListener('click', closeModal);
cancelWithdrawBtn.addEventListener('click', closeModal);

window.addEventListener('click', (e) => {
    if (e.target === modal) {
        closeModal();
    }
});

// Handle Withdrawal Submission & Log History
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

    // Prepare updated item data
    const updatedItem = { ...inventory[itemIndex] };
    updatedItem.qty -= amountToWithdraw;

    // Create history record object
    const record = {
        date: new Date().toLocaleString(),
        itemName: inventory[itemIndex].name,
        itemSku: inventory[itemIndex].sku,
        qty: amountToWithdraw
    };

    try {
        // 1. Update the item's quantity on the server
        await fetch(`${API_URL}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: updatedItem.name,
                sku: updatedItem.sku,
                qty: updatedItem.qty,
                price: updatedItem.price
            })
        });

        // 2. Send history record to server
        await fetch(HISTORY_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(record)
        });

        // Refresh everything from the server
        await init(); 
        closeModal();
    } catch (error) {
        console.error("Error processing withdrawal:", error);
    }
});

// Run app
init();