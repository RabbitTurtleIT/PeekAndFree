function displaySafetyNotices(response) {
    const data = response;
    const items = data.items.item;
    let html = ''

    items.forEach(item => {

        html += `
        <div class="row">
            <div class="col-8">
            <span class="badge text-bg-warning">${item.ctgy_nm}</span> <a href="#countryalert">[${item.continent_nm}] ${item.title}</a>
            </div>
            <div class="col-3 text-end">
            ${item.wrt_dt}
            </div>
        </div>`
// ${item.continent_nm} ${item.ctgy_nm} {item.wrt_dt} ${item.country_nm} ${item.country_eng_nm} ${item.title}
//                             ${item.txt_origin_cn.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replaceAll("<br>", "")}
//                         </div>
//                         ${item.other_country_cnt > 0 ? `
//                             <div class="mt-3">
//                                 <small class="text-info">기타 ${item.other_country_cnt}개국 포함</small>
//                             </div>
//                         ` : ''}
//                     </div>
//                     <div class="card-footer bg-transparent">
//                         <button class="btn btn-outline-primary btn-sm" 
//                                 onclick="showModal('${item.sfty_notice_id}', '${item.title}', \`${item.txt_origin_cn}\`)">
//                             자세히 보기
//                         </button>
//                         ${item.file_download_url ? `
//                             <a href="${item.file_download_url}" class="btn btn-outline-success btn-sm ms-2" target="_blank">
//                                 파일 다운로드
//                             </a>
//                         ` : ''}`;

    });


    $('#countryalert').append(html);

}