document.addEventListener('DOMContentLoaded', () => {
    const passwordModal = document.getElementById('password-modal');
    const passwordForm = document.getElementById('password-form');
    const passwordInput = document.getElementById('password-input');
    const errorMessage = document.getElementById('error-message');
    const mainContent = document.getElementById('main-content');
    const submitButton = passwordForm.querySelector('button[type=\"submit\"]');
    
    lucide.createIcons();

    const showMainContent = () => {
        errorMessage.classList.add('hidden');
        passwordModal.classList.add('fade-out');
        passwordModal.addEventListener('transitionend', () => {
            passwordModal.classList.add('hidden');
        }, { once: true });
        mainContent.classList.remove('hidden');
        lucide.createIcons(); 
        
        setupUploadLogic();
    };

    if (sessionStorage.getItem('authToken')) {
        showMainContent();
    }

    if (passwordForm) {
        passwordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const originalButtonText = submitButton.innerHTML;
            submitButton.disabled = true;
            submitButton.innerHTML = `<i data-lucide=\"loader\" class=\"animate-spin h-5 w-5 mx-auto\"></i>`;
            lucide.createIcons();

            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password: passwordInput.value })
                });

                if (response.ok) {
                    const data = await response.json();
                    sessionStorage.setItem('authToken', data.token);
                    showMainContent();
                } else {
                    errorMessage.classList.remove('hidden');
                    passwordInput.value = '';
                    passwordInput.focus();
                    const modalBox = passwordModal.querySelector('div');
                    modalBox.classList.add('animate-shake');
                    setTimeout(() => {
                       modalBox.classList.remove('animate-shake');
                    }, 500);
                }
            } catch (error) {
                console.error('Login error:', error);
                errorMessage.textContent = '网络错误，请稍后重试。';
                errorMessage.classList.remove('hidden');
            } finally {
                submitButton.disabled = false;
                submitButton.innerHTML = originalButtonText;
            }
        });
    }

    function setupUploadLogic() {
        const uploadForm = document.getElementById('upload-form');
        if (!uploadForm) return;

        const uploadButton = uploadForm.querySelector('button[type="submit"]');
        const originalButtonHTML = uploadButton.innerHTML;

        uploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const token = sessionStorage.getItem('authToken');
            if (!token) {
                alert('认证失败，请重新登录。');
                return;
            }

            uploadButton.disabled = true;
            uploadButton.innerHTML = `<i data-lucide="loader" class="animate-spin h-5 w-5 mr-2"></i> 上传中...`;
            lucide.createIcons();

            try {
                const formData = new FormData(uploadForm);
                const file = formData.get('comicFile');

                if (!file || file.size === 0) {
                    alert('请选择一个文件进行上传。');
                    throw new Error('No file selected');
                }
                if (file.size > 500 * 1024 * 1024) {
                    alert('文件大小不能超过 500MB。');
                    throw new Error('File too large');
                }

                const response = await fetch('/api/upload', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    body: formData
                });
                
                const result = await response.json().catch(() => ({}));

                if (response.ok) {
                    alert(result.message || "上传成功！");
                    uploadForm.reset();
                } else {
                    alert(`上传失败: ${result.message || '服务器返回未知错误。'}`);
                }

            } catch (error) {
                if (error.message !== 'No file selected' && error.message !== 'File too large') {
                    console.error("Upload failed:", error);
                    alert("上传过程中发生网络错误。");
                }
            } finally {
                uploadButton.disabled = false;
                uploadButton.innerHTML = originalButtonHTML;
                lucide.createIcons();
            }
        });
    }
});
