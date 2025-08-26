document.addEventListener('DOMContentLoaded', () => {
    const bookshelfGrid = document.getElementById('bookshelf-grid');

    if (bookshelfGrid) {

        for (let i = 1; i <= 10; i++) {
            const card = document.createElement('div');
            card.className = 'bookshelf-card bg-white rounded-xl shadow-md overflow-hidden flex flex-col p-6 items-center';
            
            card.innerHTML = `
                <div class="flex-grow flex items-center justify-center w-full mb-6">
                    <i data-lucide="book-case" class="w-20 h-20 text-gray-300"></i>
                </div>
                <div class="w-full">
                    <h3 class="font-semibold text-lg text-center text-gray-800 mb-6">书柜 #${i}</h3>
                    <div class="grid grid-cols-2 gap-3">
                        <button class="share-button w-full py-2 px-4 rounded-lg font-semibold text-sm btn-secondary" data-bookshelf-id="${i}">
                            分享
                        </button>
                        <button class="enter-button w-full py-2 px-4 rounded-lg font-semibold text-sm btn-primary" data-bookshelf-id="${i}">
                            进入
                        </button>
                    </div>
                </div>
            `;
            bookshelfGrid.appendChild(card);
        }
    }


    lucide.createIcons();


    document.querySelectorAll('.share-button').forEach(button => {
        button.addEventListener('click', () => {
            window.location.href = 'share.html';
        });
    });

    document.querySelectorAll('.enter-button').forEach(button => {
        button.addEventListener('click', (e) => {
            const bookshelfId = e.currentTarget.dataset.bookshelfId;
            window.location.href = `bookshelf.html?id=${bookshelfId}`;
        });
    });
});
