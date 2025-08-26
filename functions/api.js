const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

async function handleLogin(request) {
    try {
        const { password } = await request.json();
        if (password === '1234') {
            const responseBody = JSON.stringify({ success: true, token: 'dummy-auth-token-for-now' });
            return new Response(responseBody, {
                status: 200,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            });
        } else {
            return new Response(JSON.stringify({ success: false, message: 'Invalid password' }), {
                status: 401,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            });
        }
    } catch (error) {
        return new Response(JSON.stringify({ success: false, message: 'Invalid request body' }), {
            status: 400,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
    }
}

function checkAuth(request) {
    const authHeader = request.headers.get('Authorization');
    return authHeader === 'Bearer dummy-auth-token-for-now';
}

async function handleGetBookshelf(id, env) {
    try {
        const list = await env.COMIC_METADATA.list({ prefix: `bookshelf:${id}:` });
        const comics = [];

        for (const key of list.keys) {
            const value = await env.COMIC_METADATA.get(key.name);
            if (value) {
                const metadata = JSON.parse(value);
                comics.push({
                    id: metadata.id,
                    title: metadata.filename,
                    type: metadata.type,
                    author: '未知作者'
                });
            }
        }
        
        return new Response(JSON.stringify(comics), {
            status: 200,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
    } catch (e) {
        console.error('KV list error:', e);
        return new Response(JSON.stringify({ success: false, message: 'Failed to retrieve bookshelf data.' }), {
            status: 500,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
    }
}

async function handleUpload(request, env) {
    if (!checkAuth(request)) {
        return new Response(JSON.stringify({ success: false, message: 'Unauthorized' }), {
            status: 401,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
    }

    try {
        const formData = await request.formData();
        const file = formData.get('comicFile');
        const bookshelfId = formData.get('bookshelfId');

        if (!file || !bookshelfId) {
            return new Response(JSON.stringify({ success: false, message: 'Missing file or bookshelfId in form data.' }), {
                status: 400,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            });
        }

        const comicId = crypto.randomUUID();
        const fileExtension = file.name.split('.').pop().toLowerCase();
        
        if (!['pdf', 'epub', 'zip'].includes(fileExtension)) {
             return new Response(JSON.stringify({ success: false, message: 'Invalid file type. Only PDF, EPUB, and ZIP are allowed.' }), {
                status: 400,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            });
        }

        await env.COMIC_BUCKET.put(comicId, file.stream(), {
            httpMetadata: {
                contentType: file.type,
                contentDisposition: `attachment; filename="${file.name}"`
            }
        });

        const metadata = {
            id: comicId,
            filename: file.name,
            bookshelfId: bookshelfId,
            uploadDate: new Date().toISOString(),
            type: fileExtension,
            r2Key: comicId,
        };
        const kvKey = `bookshelf:${bookshelfId}:${comicId}`;
        await env.COMIC_METADATA.put(kvKey, JSON.stringify(metadata));

        return new Response(JSON.stringify({ success: true, message: 'Upload successful.' }), {
            status: 200,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });

    } catch (e) {
        console.error('Upload error:', e);
        return new Response(JSON.stringify({ success: false, message: `Upload failed: ${e.message}` }), {
            status: 500,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
    }
}

async function handleDeleteComic(request, id, env) {
    if (!checkAuth(request)) {
        return new Response(JSON.stringify({ success: false, message: 'Unauthorized' }), {
            status: 401,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
    }

    try {
        const url = new URL(request.url);
        const bookshelfId = url.searchParams.get('bookshelf');

        if (!bookshelfId) {
            return new Response(JSON.stringify({ success: false, message: 'Bookshelf ID is required for deletion.' }), {
                status: 400,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            });
        }
        
        const kvKey = `bookshelf:${bookshelfId}:${id}`;
        
        await env.COMIC_METADATA.delete(kvKey);
        await env.COMIC_BUCKET.delete(id);

        return new Response(JSON.stringify({ success: true, message: 'Comic deleted successfully.' }), {
            status: 200,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
    } catch (e) {
        console.error('Delete error:', e);
        return new Response(JSON.stringify({ success: false, message: `Deletion failed: ${e.message}` }), {
            status: 500,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
    }
}

function handleOptions(request) {
    return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
    });
}

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;
        const method = request.method;

        if (method === 'OPTIONS') {
            return handleOptions(request);
        }

        try {
            if (method === 'POST' && path === '/api/login') {
                return handleLogin(request);
            }

            const bookshelfMatch = path.match(new RegExp('^/api/bookshelf/([^/]+)'));
            if (method === 'GET' && bookshelfMatch) {
                return await handleGetBookshelf(bookshelfMatch[1], env);
            }

            if (method === 'POST' && path === '/api/upload') {
                return await handleUpload(request, env);
            }
            
            const comicMatch = path.match(new RegExp('^/api/comic/([^/]+)'));
            if (method === 'DELETE' && comicMatch) {
                return await handleDeleteComic(request, comicMatch[1], env);
            }

            return new Response('Not Found', { status: 404, headers: CORS_HEADERS });
        } catch (e) {
            return new Response(e.message, { status: 500, headers: CORS_HEADERS });
        }
    },
};
