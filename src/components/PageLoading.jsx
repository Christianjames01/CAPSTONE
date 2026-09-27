import './PageLoading.css'

// Shown while a page's code downloads (see App.jsx). Inside a portal layout
// only the content area shows it, so the sidebar stays put.
function PageLoading({ inline = false }) {
    return (
        <div className={`page-loading${inline ? ' is-inline' : ''}`} role="status" aria-label="Loading">
            <span className="page-loading-bar" />
        </div>
    )
}

export default PageLoading
