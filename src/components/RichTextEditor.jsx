import React, { useState, useRef } from 'react';
import { 
  Bold, Italic, Underline, List, ListOrdered, Link, Image, 
  Video, AlignLeft, AlignCenter, Heading1, Heading2, Quote,
  Code, Minus, Eye, Edit3
} from 'lucide-react';

function RichTextEditor({ value, onChange, placeholder = "Start typing..." }) {
  const editorRef = useRef(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const execCommand = (command, value = null) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleChange();
  };

  const handleChange = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const insertLink = () => {
    if (linkUrl) {
      execCommand('createLink', linkUrl);
      setLinkUrl('');
      setShowLinkModal(false);
    }
  };

  const insertVideo = () => {
    if (videoUrl) {
      let embedUrl = videoUrl;
      
      // Convert YouTube URLs
      const ytMatch = videoUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
      if (ytMatch) {
        embedUrl = `https://www.youtube.com/embed/${ytMatch[1]}`;
      }
      
      // Convert Vimeo URLs
      const vimeoMatch = videoUrl.match(/vimeo\.com\/(\d+)/);
      if (vimeoMatch) {
        embedUrl = `https://player.vimeo.com/video/${vimeoMatch[1]}`;
      }
      
      // Convert Loom URLs
      const loomMatch = videoUrl.match(/loom\.com\/share\/([a-zA-Z0-9]+)/);
      if (loomMatch) {
        embedUrl = `https://www.loom.com/embed/${loomMatch[1]}`;
      }
      
      const videoHtml = `
        <div class="video-embed" contenteditable="false" style="position: relative; padding-bottom: 56.25%; height: 0; margin: 16px 0;">
          <iframe 
            src="${embedUrl}" 
            style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0; border-radius: 8px;"
            allowfullscreen
          ></iframe>
        </div>
        <p><br></p>
      `;
      
      execCommand('insertHTML', videoHtml);
      setVideoUrl('');
      setShowVideoModal(false);
    }
  };

  const insertImage = () => {
    if (imageUrl) {
      const imageHtml = `
        <div style="margin: 16px 0;">
          <img src="${imageUrl}" alt="Training image" style="max-width: 100%; height: auto; border-radius: 8px;" />
        </div>
      `;
      execCommand('insertHTML', imageHtml);
      setImageUrl('');
      setShowImageModal(false);
    }
  };

  const insertDivider = () => {
    execCommand('insertHTML', '<hr style="border: none; border-top: 2px solid #e2e8f0; margin: 24px 0;" />');
  };

  const ToolbarButton = ({ onClick, active, children, title }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-2 rounded hover:bg-slate-100 transition-colors ${active ? 'bg-slate-200 text-asap-blue' : 'text-slate-600'}`}
    >
      {children}
    </button>
  );

  return (
    <div className="border border-slate-300 rounded-lg overflow-hidden bg-white">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 border-b border-slate-200 bg-slate-50">
        <ToolbarButton onClick={() => execCommand('bold')} title="Bold">
          <Bold className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => execCommand('italic')} title="Italic">
          <Italic className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => execCommand('underline')} title="Underline">
          <Underline className="w-4 h-4" />
        </ToolbarButton>
        
        <div className="w-px h-6 bg-slate-300 mx-1" />
        
        <ToolbarButton onClick={() => execCommand('formatBlock', '<h1>')} title="Heading 1">
          <Heading1 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => execCommand('formatBlock', '<h2>')} title="Heading 2">
          <Heading2 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => execCommand('formatBlock', '<blockquote>')} title="Quote">
          <Quote className="w-4 h-4" />
        </ToolbarButton>
        
        <div className="w-px h-6 bg-slate-300 mx-1" />
        
        <ToolbarButton onClick={() => execCommand('insertUnorderedList')} title="Bullet List">
          <List className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => execCommand('insertOrderedList')} title="Numbered List">
          <ListOrdered className="w-4 h-4" />
        </ToolbarButton>
        
        <div className="w-px h-6 bg-slate-300 mx-1" />
        
        <ToolbarButton onClick={() => setShowLinkModal(true)} title="Insert Link">
          <Link className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => setShowImageModal(true)} title="Insert Image">
          <Image className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => setShowVideoModal(true)} title="Insert Video">
          <Video className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={insertDivider} title="Insert Divider">
          <Minus className="w-4 h-4" />
        </ToolbarButton>
        
        <div className="flex-1" />
        
        <ToolbarButton 
          onClick={() => setShowPreview(!showPreview)} 
          active={showPreview}
          title={showPreview ? "Edit" : "Preview"}
        >
          {showPreview ? <Edit3 className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </ToolbarButton>
      </div>

      {/* Editor / Preview */}
      {showPreview ? (
        <div 
          className="p-4 min-h-[300px] prose max-w-none"
          dangerouslySetInnerHTML={{ __html: value || '<p class="text-slate-400">No content yet...</p>' }}
        />
      ) : (
        <div
          ref={editorRef}
          contentEditable
          className="p-4 min-h-[300px] focus:outline-none prose max-w-none"
          onInput={handleChange}
          onBlur={handleChange}
          dangerouslySetInnerHTML={{ __html: value || '' }}
          data-placeholder={placeholder}
          style={{ 
            minHeight: '300px',
          }}
        />
      )}

      {/* Link Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Insert Link</h3>
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowLinkModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={insertLink}
                className="px-4 py-2 bg-asap-blue text-white rounded-lg"
              >
                Insert
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video Modal */}
      {showVideoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-2">Insert Video</h3>
            <p className="text-sm text-slate-500 mb-4">
              Paste a YouTube, Vimeo, or Loom URL
            </p>
            <input
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowVideoModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={insertVideo}
                className="px-4 py-2 bg-asap-blue text-white rounded-lg"
              >
                Insert
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Modal */}
      {showImageModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-2">Insert Image</h3>
            <p className="text-sm text-slate-500 mb-4">
              Paste an image URL
            </p>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowImageModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={insertImage}
                className="px-4 py-2 bg-asap-blue text-white rounded-lg"
              >
                Insert
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #94a3b8;
          pointer-events: none;
        }
        .prose h1 { font-size: 1.875rem; font-weight: 700; margin-bottom: 1rem; color: #1e293b; }
        .prose h2 { font-size: 1.5rem; font-weight: 600; margin-bottom: 0.75rem; color: #1e293b; }
        .prose p { margin-bottom: 1rem; line-height: 1.75; }
        .prose ul, .prose ol { margin-bottom: 1rem; padding-left: 1.5rem; }
        .prose li { margin-bottom: 0.5rem; }
        .prose blockquote { border-left: 4px solid #1e5799; padding-left: 1rem; margin: 1rem 0; color: #64748b; font-style: italic; }
        .prose a { color: #1e5799; text-decoration: underline; }
        .prose img { border-radius: 8px; max-width: 100%; }
      `}</style>
    </div>
  );
}

export default RichTextEditor;
