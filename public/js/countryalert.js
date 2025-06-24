function displaySafetyNotices(response) {
    const data = response;
    const items = data.items.item;
    let html = `
        <div class="container py-4">
            <div class="row">
                <div class="col-12">
                    <h1 class="mb-4 text-center text-primary">해외안전공지</h1>
                    
                    <div class="row">
    `;

    items.forEach(item => {
        html += `
            <div class="col-md-6 col-sm-12 mb-4">
                <div class="card h-100">
                    <div class="card-header bg-light">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <span class="badge bg-secondary me-2">${item.continent_nm}</span>
                                <span class="badge bg-warning text-dark">${item.ctgy_nm}</span>
                            </div>
                            <small class="text-muted">${item.wrt_dt}</small>
                        </div>
                    </div>
                    <div class="card-body">
                        <h6 class="card-title text-primary">${item.country_nm} ${item.country_eng_nm}</h6>
                        <h5 class="card-subtitle mb-3">${item.title}</h5>
                        <div class="text-muted" style="max-height: 200px; overflow-y: auto;">
                            ${item.txt_origin_cn.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replaceAll("<br>", "")}
                        </div>
                        ${item.other_country_cnt > 0 ? `
                            <div class="mt-3">
                                <small class="text-info">기타 ${item.other_country_cnt}개국 포함</small>
                            </div>
                        ` : ''}
                    </div>
                    <div class="card-footer bg-transparent">
                        <button class="btn btn-outline-primary btn-sm" 
                                onclick="showModal('${item.sfty_notice_id}', '${item.title}', \`${item.txt_origin_cn}\`)">
                            자세히 보기
                        </button>
                        ${item.file_download_url ? `
                            <a href="${item.file_download_url}" class="btn btn-outline-success btn-sm ms-2" target="_blank">
                                파일 다운로드
                            </a>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    });

    html += `
                    </div>
                </div>
            </div>
        </div>
    `;

    $('body').append(html);

    // 모달 함수
    window.showModal = function(id, title, content) {
        const modalHtml = `
            <div class="modal fade" id="detailModal" tabindex="-1">
                <div class="modal-dialog modal-dialog-scrollable modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">${title}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="alert alert-info">공지 ID: ${id}</div>
                            <div>
                                ${content.replaceAll("<br>", "")}

                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">닫기</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        $('#detailModal').remove();
        $('body').append(modalHtml);
        $('#detailModal').modal('show');
    };
}