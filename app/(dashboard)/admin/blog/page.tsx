'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { blogApi } from '@/lib/api';
import { toast } from 'sonner';
import {
  Plus, Pencil, Trash2, Eye, EyeOff, Loader2,
  X, Check, FileText, Calendar, Clock,
} from 'lucide-react';

interface Post {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  category: string | null;
  status: 'draft' | 'published';
  read_time_mins: number;
  published_at: string | null;
  updated_at: string;
  author: { id: number; name: string } | null;
}

interface PostForm {
  title: string;
  content: string;
  excerpt: string;
  category: string;
  cover_image_url: string;
  tags: string;
  status: 'draft' | 'published';
}

const EMPTY_FORM: PostForm = {
  title: '', content: '', excerpt: '', category: '',
  cover_image_url: '', tags: '', status: 'draft',
};

const CATEGORIES = ['Freight', 'Dispatch', 'Compliance', 'Platform', 'Carrier Tips', 'Shipper Guide', 'Industry News'];

const INPUT = 'w-full rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-cream)] px-3.5 py-2.5 text-sm text-[var(--color-text)] focus:border-[var(--color-teal)] focus:outline-none focus:ring-2 focus:ring-[var(--color-teal)]/20';

function PostEditor({ post, onClose }: {
  post: Post | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<PostForm>(post ? {
    title:           post.title,
    content:         '',  // loaded separately
    excerpt:         post.excerpt ?? '',
    category:        post.category ?? '',
    cover_image_url: '',
    tags:            '',
    status:          post.status,
  } : EMPTY_FORM);

  // Load full content when editing
  const { data: fullPost } = useQuery({
    queryKey: ['blog-admin-post', post?.id],
    queryFn:  () => blogApi.get(post!.slug).then(r => r.data.data),
    enabled:  !!post,
    onSuccess: (d: any) => setForm(f => ({ ...f, content: d.content, tags: (d.tags ?? []).join(', '), cover_image_url: d.cover_image_url ?? '' })),
  } as any);

  const set = (k: keyof PostForm) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const saveMutation = useMutation({
    mutationFn: () => {
      const data = {
        title:           form.title,
        content:         form.content,
        excerpt:         form.excerpt || undefined,
        category:        form.category || undefined,
        cover_image_url: form.cover_image_url || undefined,
        tags:            form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        status:          form.status,
      };
      return post
        ? blogApi.update(post.id, data)
        : blogApi.create(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-blog'] });
      toast.success(post ? 'Post updated' : 'Post created');
      onClose();
    },
    onError: () => toast.error('Failed to save post'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto p-4 pt-10">
      <div className="w-full max-w-3xl bg-[var(--color-white)] rounded-2xl shadow-2xl mb-10">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-cream-dark)]">
          <h2 className="text-base font-semibold text-[var(--color-text)]">
            {post ? 'Edit Post' : 'New Post'}
          </h2>
          <button onClick={onClose} className="text-[var(--color-text-faint)] hover:text-[var(--color-text)]">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">Title *</label>
            <input value={form.title} onChange={e => set('title')(e.target.value)} placeholder="Post title" className={INPUT} />
          </div>

          {/* Meta row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">Category</label>
              <select value={form.category} onChange={e => set('category')(e.target.value)} className={INPUT}>
                <option value="">None</option>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">Status</label>
              <select value={form.status} onChange={e => set('status')(e.target.value as any)} className={INPUT}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
          </div>

          {/* Cover image */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">Cover image URL</label>
            <input value={form.cover_image_url} onChange={e => set('cover_image_url')(e.target.value)} placeholder="https://..." className={INPUT} />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">Tags <span className="normal-case font-normal text-[var(--color-text-faint)]">(comma-separated)</span></label>
            <input value={form.tags} onChange={e => set('tags')(e.target.value)} placeholder="freight, compliance, tips" className={INPUT} />
          </div>

          {/* Excerpt */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">Excerpt <span className="normal-case font-normal text-[var(--color-text-faint)]">(auto-generated if empty)</span></label>
            <textarea rows={2} value={form.excerpt} onChange={e => set('excerpt')(e.target.value)} placeholder="Brief description shown in listings" className={`${INPUT} resize-none`} />
          </div>

          {/* Content */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">Content * <span className="normal-case font-normal text-[var(--color-text-faint)]">(HTML supported)</span></label>
            <textarea
              rows={16}
              value={form.content}
              onChange={e => set('content')(e.target.value)}
              placeholder="<p>Start writing your post...</p>"
              className={`${INPUT} resize-y font-mono text-xs`}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--color-cream-dark)]">
          <button onClick={onClose} className="rounded-xl border border-[var(--color-cream-dark)] px-4 py-2 text-sm text-[var(--color-text-muted)] hover:border-[var(--color-teal)] transition-colors">
            Cancel
          </button>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={!form.title || !form.content || saveMutation.isPending}
            className="flex items-center gap-2 rounded-xl bg-[var(--color-teal)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--color-teal-dark)] disabled:opacity-60 transition-colors"
          >
            {saveMutation.isPending ? <><Loader2 size={13} className="animate-spin" /> Saving…</> : <><Check size={13} /> {post ? 'Update post' : 'Publish post'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminBlogPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Post | null | 'new'>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-blog'],
    queryFn:  () => blogApi.adminList().then(r => r.data),
  });

  const posts: Post[] = data?.data ?? [];

  const deleteMutation = useMutation({
    mutationFn: (id: number) => blogApi.destroy(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-blog'] });
      toast.success('Post deleted');
    },
    onError: () => toast.error('Failed to delete'),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      blogApi.update(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-blog'] }),
    onError: () => toast.error('Failed to update status'),
  });

  return (
    <>
      {editing !== null && (
        <PostEditor
          post={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Blog</h1>
            <p className="text-sm text-[var(--color-text-muted)] mt-0.5">{data?.meta?.total ?? 0} total posts</p>
          </div>
          <button
            onClick={() => setEditing('new')}
            className="flex items-center gap-2 rounded-xl bg-[var(--color-teal)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-teal-dark)] transition-colors"
          >
            <Plus size={14} /> New post
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-3 animate-pulse">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 rounded-xl bg-[var(--color-cream-dark)]" />)}
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--color-cream-dark)] py-20 text-center">
            <FileText size={32} className="mx-auto mb-3 text-[var(--color-text-faint)]" />
            <p className="font-semibold text-[var(--color-text)]">No posts yet</p>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">Write your first post to get started.</p>
            <button onClick={() => setEditing('new')} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-teal)] hover:underline">
              <Plus size={13} /> Create post
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] overflow-hidden">
            {posts.map((post, i) => (
              <div key={post.id} className={`flex items-center gap-4 px-5 py-4 ${i > 0 ? 'border-t border-[var(--color-cream-dark)]' : ''}`}>

                {/* Status dot */}
                <div className={`w-2 h-2 rounded-full shrink-0 ${post.status === 'published' ? 'bg-emerald-500' : 'bg-amber-400'}`} />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[var(--color-text)] truncate">{post.title}</p>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-[var(--color-text-faint)]">
                    {post.category && <span className="flex items-center gap-1"><FileText size={10} /> {post.category}</span>}
                    <span className="flex items-center gap-1"><Clock size={10} /> {post.read_time_mins}m read</span>
                    {post.published_at && (
                      <span className="flex items-center gap-1">
                        <Calendar size={10} />
                        {new Date(post.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    )}
                    {post.author && <span>{post.author.name}</span>}
                  </div>
                </div>

                {/* Status badge */}
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  post.status === 'published' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                }`}>
                  {post.status === 'published' ? 'Published' : 'Draft'}
                </span>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => toggleStatusMutation.mutate({
                      id: post.id,
                      status: post.status === 'published' ? 'draft' : 'published',
                    })}
                    title={post.status === 'published' ? 'Unpublish' : 'Publish'}
                    className="p-1.5 rounded-lg text-[var(--color-text-faint)] hover:text-[var(--color-teal)] hover:bg-[var(--color-cream)] transition-colors"
                  >
                    {post.status === 'published' ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button
                    onClick={() => setEditing(post)}
                    className="p-1.5 rounded-lg text-[var(--color-text-faint)] hover:text-[var(--color-teal)] hover:bg-[var(--color-cream)] transition-colors"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Delete this post permanently?')) deleteMutation.mutate(post.id);
                    }}
                    className="p-1.5 rounded-lg text-[var(--color-text-faint)] hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
