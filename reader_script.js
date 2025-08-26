document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();

    const params = new URLSearchParams(window.location.search);
    const comicId = params.get('id');
    const comicType = params.get('type');
    const bookshelfId = params.get('bookshelf');

    const viewerContainer = document.getElementById('viewer-container');
    const loader = document.getElementById('loader');
    const comicTitleEl = document.getElementById('comic-title');
    const backToBookshelfBtn = document.getElementById('back-to-bookshelf');

    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    const pageIndicator = document.getElementById('page-indicator');
    
    const zoomInBtn = document.getElementById('zoom-in');
    const zoomOutBtn = document.getElementById('zoom-out');
    const fitScreenBtn = document.getElementById('fit-screen');
    const fullscreenBtn = document.getElementById('fullscreen');

    const deleteBtn = document.getElementById('delete-comic');
    const deleteModal = document.getElementById('delete-modal');
    const cancelDeleteBtn = document.getElementById('cancel-delete');
    const confirmDeleteBtn = document.getElementById('confirm-delete');
    const passwordInput = document.getElementById('delete-password');
    const passwordError = document.getElementById('password-error');

    let viewerState = {
        type: null,
        instance: null,
        currentPage: 1,
        totalPages: 0,
        scale: 1.0,
    };
    
    const PLACEHOLDER_SOURCES = {
        pdf: 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf',
        epub: 'https://s3.amazonaws.com/moby-dick/moby-dick.epub',
        zip: [
            'https://via.placeholder.com/800x1200.png?text=Page+1',
            'https://via.placeholder.com/800x1200.png?text=Page+2',
            'https://via.placeholder.com/800x1200.png?text=Page+3',
            'https://via.placeholder.com/800x1200.png?text=Page+4',
            'https://via.placeholder.com/800x1200.png?text=Page+5'
        ]
    };
    
    function setupUI() {
        comicTitleEl.textContent = `阅读 ${comicId} (${comicType})`;
        document.title = `阅读 ${comicId} - 漫画阅读器`;
        if (bookshelfId) {
            backToBookshelfBtn.href = `bookshelf.html?id=${bookshelfId}`;
        }
    }

    function updatePageIndicator() {
        if (viewerState.totalPages > 0) {
            pageIndicator.textContent = `${viewerState.currentPage} / ${viewerState.totalPages}`;
        } else {
            pageIndicator.textContent = `${viewerState.currentPage}`;
        }
        prevPageBtn.disabled = viewerState.currentPage <= 1;
        nextPageBtn.disabled = viewerState.currentPage >= viewerState.totalPages;
    }

    function cleanupViewer() {
        viewerContainer.innerHTML = '';
        viewerContainer.appendChild(loader);
        loader.classList.remove('hidden');
    }

    function initViewer() {
        cleanupViewer();
        viewerState.type = comicType;

        switch (comicType) {
            case 'pdf':
                initPdfViewer(PLACEHOLDER_SOURCES.pdf);
                break;
            case 'epub':
                initEpubViewer(PLACEHOLDER_SOURCES.epub);
                break;
            case 'zip':
                initImageViewer(PLACEHOLDER_SOURCES.zip);
                break;
            default:
                loader.textContent = '不支持的文件类型';
        }
    }
    
    async function initPdfViewer(url) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        viewerContainer.innerHTML = '';
        viewerContainer.appendChild(canvas);
        
        try {
            const pdf = await pdfjsLib.getDocument(url).promise;
            viewerState.instance = { pdf, canvas, context };
            viewerState.totalPages = pdf.numPages;
            viewerState.currentPage = 1;
            renderPdfPage();
            zoomInBtn.disabled = zoomOutBtn.disabled = fitScreenBtn.disabled = false;
        } catch (error) {
            loader.textContent = '加载PDF失败';
            viewerContainer.innerHTML = '';
            viewerContainer.appendChild(loader);
        }
    }

    async function renderPdfPage() {
        if (!viewerState.instance) return;
        const { pdf, canvas, context } = viewerState.instance;
        const page = await pdf.getPage(viewerState.currentPage);
        const viewport = page.getViewport({ scale: viewerState.scale });
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = { canvasContext: context, viewport: viewport };
        await page.render(renderContext).promise;
        
        updatePageIndicator();
        loader.classList.add('hidden');
    }

    async function initEpubViewer(url) {
        const book = ePub(url);
        const viewer = document.createElement('div');
        viewer.id = 'epub-viewer';
        viewerContainer.innerHTML = '';
        viewerContainer.appendChild(viewer);

        const rendition = book.renderTo("epub-viewer", { width: "100%", height: "100%" });
        await rendition.display();
        
        viewerState.instance = { book, rendition };
        
        book.ready.then(() => {
             book.locations.generate(1024).then(locations => {
                viewerState.totalPages = book.locations.length();
                updatePageIndicator();
            });
        });

        rendition.on("relocated", (location) => {
            viewerState.currentPage = book.locations.locationFromCfi(location.start.cfi) || location.start.displayed.page;
            updatePageIndicator();
        });

        loader.classList.add('hidden');
        zoomInBtn.disabled = zoomOutBtn.disabled = fitScreenBtn.disabled = true;
    }

    function initImageViewer(imageUrls) {
        const img = document.createElement('img');
        img.id = 'image-viewer';
        viewerContainer.innerHTML = '';
        viewerContainer.appendChild(img);
        
        viewerState.instance = { img, imageUrls };
        viewerState.totalPages = imageUrls.length;
        viewerState.currentPage = 1;
        renderImage();
        loader.classList.add('hidden');
        zoomInBtn.disabled = zoomOutBtn.disabled = fitScreenBtn.disabled = true;
    }

    function renderImage() {
        const { img, imageUrls } = viewerState.instance;
        if (viewerState.currentPage > 0 && viewerState.currentPage <= viewerState.totalPages) {
            img.src = imageUrls[viewerState.currentPage - 1];
            updatePageIndicator();
        }
    }
    
    function handleNextPage() {
        if (viewerState.currentPage >= viewerState.totalPages) return;
        viewerState.currentPage++;
        switch(viewerState.type) {
            case 'pdf': renderPdfPage(); break;
            case 'epub': viewerState.instance.rendition.next(); break;
            case 'zip': renderImage(); break;
        }
    }
    
    function handlePrevPage() {
        if (viewerState.currentPage <= 1) return;
        viewerState.currentPage--;
        switch(viewerState.type) {
            case 'pdf': renderPdfPage(); break;
            case 'epub': viewerState.instance.rendition.prev(); break;
            case 'zip': renderImage(); break;
        }
    }

    function handleZoom(factor) {
        if (viewerState.type !== 'pdf' || !viewerState.instance) return;
        viewerState.scale *= factor;
        renderPdfPage();
    }
    
    function handleFitScreen() {
        if (viewerState.type !== 'pdf' || !viewerState.instance) return;
        const { page } = viewerState.instance.pdf.getPage(viewerState.currentPage).then(page => {
            const viewport = page.getViewport({ scale: 1 });
            const scale = viewerContainer.clientWidth / viewport.width;
            viewerState.scale = scale;
            renderPdfPage();
        });
    }

    function handleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    }

    function showDeleteModal() {
        passwordInput.value = '';
        passwordError.classList.add('hidden');
        deleteModal.classList.remove('hidden');
        deleteModal.classList.add('flex');
    }

    function hideDeleteModal() {
        deleteModal.classList.add('hidden');
        deleteModal.classList.remove('flex');
    }

    async function handleDelete() {
        passwordError.classList.add('hidden');
        const token = sessionStorage.getItem('authToken');

        if (!token) {
            passwordError.textContent = '您需要先在分享页面登录才能删除。';
            passwordError.classList.remove('hidden');
            return;
        }

        if (passwordInput.value !== '1234') {
            passwordError.textContent = '密码错误。';
            passwordError.classList.remove('hidden');
            return;
        }
        
        confirmDeleteBtn.disabled = true;
        confirmDeleteBtn.textContent = '删除中...';

        try {
            const response = await fetch(`/api/comic/${comicId}?bookshelf=${bookshelfId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                alert('漫画已删除');
                hideDeleteModal();
                window.location.href = backToBookshelfBtn.href;
            } else {
                const errorData = await response.json().catch(() => ({ message: '请稍后重试。' }));
                passwordError.textContent = `删除失败: ${errorData.message}`;
                passwordError.classList.remove('hidden');
            }
        } catch (error) {
            passwordError.textContent = '网络错误，请检查您的连接。';
            passwordError.classList.remove('hidden');
        } finally {
            confirmDeleteBtn.disabled = false;
            confirmDeleteBtn.textContent = '确认删除';
        }
    }

    nextPageBtn.addEventListener('click', handleNextPage);
    prevPageBtn.addEventListener('click', handlePrevPage);
    zoomInBtn.addEventListener('click', () => handleZoom(1.2));
    zoomOutBtn.addEventListener('click', () => handleZoom(0.8));
    fitScreenBtn.addEventListener('click', handleFitScreen);
    fullscreenBtn.addEventListener('click', handleFullscreen);

    deleteBtn.addEventListener('click', showDeleteModal);
    cancelDeleteBtn.addEventListener('click', hideDeleteModal);
    confirmDeleteBtn.addEventListener('click', handleDelete);
    passwordInput.addEventListener('input', () => passwordError.classList.add('hidden'));


    setupUI();
    initViewer();
});
