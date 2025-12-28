
import { LibraryData, ProjectNode, ProjectVersion } from '../types';

// XML 字符转义辅助函数
const escapeXml = (unsafe: string) => {
  return (unsafe || '').replace(/[<>&'"]/g, function (c) {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
};

/**
 * 生成基于 HTML 的 Word 文档 (.doc)
 * 我们使用 HTML 表格，因为 Word 原生支持它们，并且可以进行复杂的格式化，而无需庞大的 JS 库。
 */
export const generateWordDoc = (project: ProjectNode[], library: LibraryData) => {
  let contentHtml = `
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: '宋体', 'Times New Roman', serif; }
          table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
          th, td { border: 1px solid black; padding: 8px; text-align: left; font-size: 10.5pt; }
          th { background-color: #f2f2f2; font-weight: bold; }
          h1 { color: #2e4053; font-size: 16pt; margin-top: 30px; }
          h2 { color: #2874a6; font-size: 14pt; margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
          h3 { color: #555; font-size: 12pt; margin-top: 15px; }
          .meta { font-size: 9pt; color: #888; font-style: italic; }
          .grid-header { background-color: #e8f4f8; }
          .form-header-vars { margin-bottom: 15px; }
          .form-header-vars td { border: none; padding: 4px 8px; vertical-align: top;}
          .sub-info { font-size: 9pt; color: #666; margin-top: 2px; }
          .logic-tag { color: #6b21a8; font-size: 9pt; font-style: italic; display: block; margin-top: 2px; }
        </style>
      </head>
      <body>
      <h1 style="text-align:center;">临床研究数据规格说明书</h1>
  `;

  // 按顺序排序
  const sortedProject = [...project].sort((a, b) => a.order - b.order);

  sortedProject.forEach(visitNode => {
    contentHtml += `<h1>访视: ${escapeXml(visitNode.visitName)} <span class="meta">(${visitNode.visitId})</span></h1>`;

    visitNode.forms.forEach(formNode => {
      const formTemplate = library.forms.find(f => f.id === formNode.formId);
      if (!formTemplate) return;

      const formName = formNode.customFormName || formTemplate.name;
      contentHtml += `<h2>表单: ${escapeXml(formName)} <span class="meta">(${formTemplate.id})</span></h2>`;
      
      const allIncludedVars = formNode.variables.filter(v => v.included);

      if (formTemplate.type === 'grid' && formNode.rows && formNode.rows.length > 0) {
        // --- 矩阵表单渲染 ---

        const headerVars = allIncludedVars.filter(v => formTemplate.headerVariableIds?.includes(v.variableId));
        const gridVars = allIncludedVars.filter(v => formTemplate.variableIds.includes(v.variableId));
        const otherVars = allIncludedVars.filter(v => 
            !formTemplate.headerVariableIds?.includes(v.variableId) && 
            !formTemplate.variableIds.includes(v.variableId)
        );
        const finalGridVars = [...gridVars, ...otherVars];

        // 2. 渲染表头变量区域 (Key-Value 形式或简单列表)
        if (headerVars.length > 0) {
            contentHtml += `<div class="form-header-vars"><table>
            <thead><tr>
                <th style="width: 25%">表头变量</th>
                <th style="width: 15%">类型</th>
                <th style="width: 25%">选项/值域</th>
                <th style="width: 15%">格式</th>
                <th style="width: 20%">逻辑/条件</th>
            </tr></thead>
            <tbody>`;
            headerVars.forEach(v => {
                 const varTemplate = library.variables.find(vt => vt.id === v.variableId);
                 const optionsStr = v.customOptions ? v.customOptions.join(', ') : (varTemplate?.options?.join(', ') || '-');
                 const formatStr = v.customFormat || varTemplate?.format || '-';
                 const logicStr = v.logic ? `当 [${v.logic.triggerId}] = "${v.logic.triggerValue}" 时激活` : '';
                 
                 contentHtml += `<tr>
                    <td style="background: #fafafa;"><b>${escapeXml(v.customLabel)}</b> <br/><span class="meta">${v.variableId}</span></td>
                    <td>${varTemplate?.type || 'Text'}</td>
                    <td>${escapeXml(optionsStr)}</td>
                    <td>${escapeXml(formatStr)}</td>
                    <td><span class="logic-tag">${escapeXml(logicStr)}</span></td>
                 </tr>`;
            });
            contentHtml += `</tbody></table></div>`;
        }

        // 3. 渲染矩阵表格
        if (finalGridVars.length > 0) {
            contentHtml += `<table><thead><tr>`;
            contentHtml += `<th class="grid-header" style="width: 15%">时间点 / 行</th>`;
            finalGridVars.forEach(v => {
                 const varTemplate = library.variables.find(vt => vt.id === v.variableId);
                 const optionsStr = v.customOptions ? v.customOptions.join('/') : (varTemplate?.options?.join('/') || '');
                 const formatStr = v.customFormat || varTemplate?.format || '';
                 const logicStr = v.logic ? `IF ${v.logic.triggerId}="${v.logic.triggerValue}"` : '';
                 
                 let infoStr = '';
                 if(optionsStr) infoStr += `[${optionsStr}]`;
                 if(formatStr) infoStr += ` {${formatStr}}`;

                 contentHtml += `<th class="grid-header">
                    ${escapeXml(v.customLabel)} <br/>
                    <span style="font-size:8pt;font-weight:normal">(${v.variableId})</span><br/>
                    <span style="font-size:8pt;font-weight:normal;color:#666">${escapeXml(infoStr)}</span>
                    ${logicStr ? `<br/><span class="logic-tag">${escapeXml(logicStr)}</span>` : ''}
                 </th>`;
            });
            contentHtml += `</tr></thead><tbody>`;

            formNode.rows.forEach(rowLabel => {
                contentHtml += `<tr>`;
                contentHtml += `<td style="font-weight:bold">${escapeXml(rowLabel)}</td>`;
                finalGridVars.forEach(v => {
                    const varTemplate = library.variables.find(vt => vt.id === v.variableId);
                    contentHtml += `<td style="color:#999; text-align:center;">[${varTemplate?.type || 'Text'}]</td>`;
                });
                contentHtml += `</tr>`;
            });
            contentHtml += `</tbody></table>`;
        } else {
            contentHtml += `<p style="color:#999; font-style:italic;">(此表单无表格列变量)</p>`;
        }

      } else {
        // --- 普通表单渲染 ---
        contentHtml += `
          <table>
            <thead>
              <tr>
                <th style="width: 15%">变量 ID</th>
                <th style="width: 25%">标签 / 问题</th>
                <th style="width: 10%">类型</th>
                <th style="width: 20%">选项 / 值域</th>
                <th style="width: 15%">格式</th>
                <th style="width: 15%">逻辑/条件</th>
              </tr>
            </thead>
            <tbody>
        `;

        allIncludedVars.forEach(varNode => {
          const variable = library.variables.find(v => v.id === varNode.variableId);
          if (variable) {
            const optionsStr = varNode.customOptions ? varNode.customOptions.join(', ') : (variable.options?.join(', ') || '');
            const formatStr = varNode.customFormat || variable.format || '';
            const logicStr = varNode.logic ? `当 [${varNode.logic.triggerId}] = "${varNode.logic.triggerValue}" 时激活` : '';

            contentHtml += `
              <tr>
                <td>${variable.id}</td>
                <td>${escapeXml(varNode.customLabel || variable.label)}</td>
                <td>${variable.type}</td>
                <td>${escapeXml(optionsStr)}</td>
                <td>${escapeXml(formatStr)}</td>
                <td><span class="logic-tag">${escapeXml(logicStr)}</span></td>
              </tr>
            `;
          }
        });
        contentHtml += `</tbody></table>`;
      }
    });
    contentHtml += `<hr style="border: 0; border-top: 2px solid #eee; margin: 30px 0;">`;
  });

  contentHtml += `</body></html>`;

  const blob = new Blob(['\ufeff', contentHtml], {
    type: 'application/msword'
  });
  
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `Study_Specifications_${new Date().toISOString().slice(0,10)}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * 生成 Excel 2003 XML 电子表格
 */
export const generateExcel = (project: ProjectNode[], library: LibraryData) => {
  // 创建单元格辅助函数
  const Cell = (val: string) => `<Cell><Data ss:Type="String">${escapeXml(val)}</Data></Cell>`;
  const Row = (cells: string) => `<Row>${cells}</Row>`;

  // Sheet 1: 扁平列表
  // 新增 "逻辑/条件" 列
  let flatRows = Row(
      Cell("访视 ID") + 
      Cell("访视名称") + 
      Cell("表单 ID") + 
      Cell("表单名称") + 
      Cell("行/时间点") + 
      Cell("变量 ID") + 
      Cell("变量标签") + 
      Cell("类型") +
      Cell("选项/值域") + 
      Cell("格式") + 
      Cell("逻辑/条件")
  );
  
  const sortedProject = [...project].sort((a, b) => a.order - b.order);

  sortedProject.forEach(visitNode => {
    visitNode.forms.forEach(formNode => {
      const form = library.forms.find(f => f.id === formNode.formId);
      if (!form) return;
      
      const formName = formNode.customFormName || form.name;
      const includedVars = formNode.variables.filter(v => v.included);

      if (form.type === 'grid' && formNode.rows && formNode.rows.length > 0) {
          // 矩阵展开：每行 x 每变量
          formNode.rows.forEach(rowLabel => {
              includedVars.forEach(varNode => {
                  const variable = library.variables.find(v => v.id === varNode.variableId);
                  if (variable) {
                    const optionsStr = varNode.customOptions ? varNode.customOptions.join(',') : (variable.options?.join(',') || '');
                    const formatStr = varNode.customFormat || variable.format || '';
                    const logicStr = varNode.logic ? `IF ${varNode.logic.triggerId}="${varNode.logic.triggerValue}"` : '';

                    flatRows += Row(
                        Cell(visitNode.visitId) + 
                        Cell(visitNode.visitName) + 
                        Cell(form.id) + 
                        Cell(formName) + 
                        Cell(rowLabel) + 
                        Cell(variable.id) + 
                        Cell(varNode.customLabel || variable.label) + 
                        Cell(variable.type) +
                        Cell(optionsStr) +
                        Cell(formatStr) + 
                        Cell(logicStr)
                    );
                  }
              });
          });
      } else {
          // 普通表单
          includedVars.forEach(varNode => {
            const variable = library.variables.find(v => v.id === varNode.variableId);
            if (variable) {
              const optionsStr = varNode.customOptions ? varNode.customOptions.join(',') : (variable.options?.join(',') || '');
              const formatStr = varNode.customFormat || variable.format || '';
              const logicStr = varNode.logic ? `IF ${varNode.logic.triggerId}="${varNode.logic.triggerValue}"` : '';

              flatRows += Row(
                Cell(visitNode.visitId) + 
                Cell(visitNode.visitName) + 
                Cell(form.id) + 
                Cell(formName) + 
                Cell("") + 
                Cell(variable.id) + 
                Cell(varNode.customLabel || variable.label) + 
                Cell(variable.type) +
                Cell(optionsStr) +
                Cell(formatStr) + 
                Cell(logicStr)
              );
            }
          });
      }
    });
  });

  // Sheet 2: 配置 (项目结构)
  let configRows = Row(Cell("项目访视 ID") + Cell("项目表单 ID") + Cell("变量 ID") + Cell("自定义标签"));
  sortedProject.forEach(v => {
    v.forms.forEach(f => {
        f.variables.forEach(variable => {
             configRows += Row(Cell(v.visitId) + Cell(f.formId) + Cell(variable.variableId) + Cell(variable.customLabel));
        })
    })
  });

  const xmlContent = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Bottom"/>
   <Borders/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
 </Styles>
 <Worksheet ss:Name="主数据">
  <Table>
   ${flatRows}
  </Table>
 </Worksheet>
 <Worksheet ss:Name="配置日志">
  <Table>
   ${configRows}
  </Table>
 </Worksheet>
</Workbook>`;

  const blob = new Blob([xmlContent], { type: 'application/vnd.ms-excel' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `Study_Config_${new Date().toISOString().slice(0,10)}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

interface ChangeRecord {
  type: '新增' | '删除' | '修改';
  level: '访视' | '表单' | '变量' | '行/时间点';
  location: string;
  item: string;
  oldValue: string;
  newValue: string;
}

export const generateChangeLogWord = (currentVersion: ProjectVersion, oldVersion: ProjectVersion) => {
  const changes: ChangeRecord[] = [];
  const curProj = currentVersion.project;
  const oldProj = oldVersion.project;
  const curLib = currentVersion.library;
  // const oldLib = oldVersion.library; // Not heavily used currently

  // 1. Compare Visits
  const curVisitIds = curProj.map(v => v.visitId);
  const oldVisitIds = oldProj.map(v => v.visitId);

  // Check Added Visits
  curProj.forEach(v => {
    if (!oldVisitIds.includes(v.visitId)) {
      changes.push({
        type: '新增',
        level: '访视',
        location: '-',
        item: `${v.visitName} (${v.visitId})`,
        oldValue: '-',
        newValue: '新增'
      });
    }
  });

  // Check Removed Visits
  oldProj.forEach(v => {
    if (!curVisitIds.includes(v.visitId)) {
       changes.push({
        type: '删除',
        level: '访视',
        location: '-',
        item: `${v.visitName} (${v.visitId})`,
        oldValue: '存在',
        newValue: '已删除'
      });
    }
  });

  // Compare Forms in existing visits
  curProj.forEach(curV => {
    const oldV = oldProj.find(ov => ov.visitId === curV.visitId);
    if (!oldV) return; // Already handled as added visit

    // Visit Name Change?
    if (curV.visitName !== oldV.visitName) {
        changes.push({
            type: '修改',
            level: '访视',
            location: curV.visitId,
            item: '访视名称',
            oldValue: oldV.visitName,
            newValue: curV.visitName
        });
    }

    const curFormIds = curV.forms.map(f => f.instanceId);
    const oldFormIds = oldV.forms.map(f => f.instanceId);

    // Added Forms
    curV.forms.forEach(f => {
      if (!oldFormIds.includes(f.instanceId)) {
         const formName = f.customFormName || curLib.forms.find(lf => lf.id === f.formId)?.name || f.formId;
         changes.push({
            type: '新增',
            level: '表单',
            location: `${curV.visitName}`,
            item: `${formName} (${f.formId})`,
            oldValue: '-',
            newValue: '新增'
         });
      }
    });

    // Removed Forms
    oldV.forms.forEach(f => {
        if (!curFormIds.includes(f.instanceId)) {
           const formName = f.customFormName || f.formId; 
           changes.push({
              type: '删除',
              level: '表单',
              location: `${curV.visitName}`,
              item: `${formName} (${f.formId})`,
              oldValue: '存在',
              newValue: '已删除'
           });
        }
    });

    // Compare Details in existing forms (Variables & Rows)
    curV.forms.forEach(curF => {
        const oldF = oldV.forms.find(of => of.instanceId === curF.instanceId);
        if (!oldF) return; // Handled as added form

        const formName = curF.customFormName || curLib.forms.find(lf => lf.id === curF.formId)?.name || curF.formId;
        const location = `${curV.visitName} > ${formName}`;

        // Check Form Name Change
        if (curF.customFormName !== oldF.customFormName) {
             const oldName = oldF.customFormName || (curLib.forms.find(lf => lf.id === oldF.formId)?.name) || oldF.formId;
             const curName = curF.customFormName || (curLib.forms.find(lf => lf.id === curF.formId)?.name) || curF.formId;
             if (oldName !== curName) {
                 changes.push({ type: '修改', level: '表单', location: curV.visitName, item: `${curF.formId} 名称`, oldValue: oldName, newValue: curName });
             }
        }

        // -- Check Rows (for Grid forms) --
        const curRows = curF.rows || [];
        const oldRows = oldF.rows || [];

        // Added Rows
        curRows.forEach(r => {
            if (!oldRows.includes(r)) {
                changes.push({ type: '新增', level: '行/时间点', location, item: r, oldValue: '-', newValue: '新增' });
            }
        });
        // Removed Rows
        oldRows.forEach(r => {
            if (!curRows.includes(r)) {
                changes.push({ type: '删除', level: '行/时间点', location, item: r, oldValue: '存在', newValue: '已删除' });
            }
        });

        // -- Check Variables (Only included ones) --
        // Note: Logic simplified here to check only 'included' status and labels
        // Deeper comparison of options/format can be added similarly
        curF.variables.forEach(curVar => {
            const oldVar = oldF.variables.find(ov => ov.variableId === curVar.variableId);
            const varLabel = curLib.variables.find(v => v.id === curVar.variableId)?.label || curVar.variableId;
            const itemName = `${varLabel} (${curVar.variableId})`;

            if (!oldVar) {
                 if (curVar.included) {
                    changes.push({ type: '新增', level: '变量', location, item: itemName, oldValue: '-', newValue: '新增' });
                 }
                 return;
            }

            if (curVar.included && !oldVar.included) {
                changes.push({ type: '新增', level: '变量', location, item: itemName, oldValue: '未包含', newValue: '包含' });
            } else if (!curVar.included && oldVar.included) {
                changes.push({ type: '删除', level: '变量', location, item: itemName, oldValue: '包含', newValue: '未包含' });
            }

            if (curVar.included && oldVar.included && curVar.customLabel !== oldVar.customLabel) {
                 changes.push({ 
                     type: '修改', 
                     level: '变量', 
                     location, 
                     item: itemName, 
                     oldValue: oldVar.customLabel, 
                     newValue: curVar.customLabel 
                 });
            }
        });
    });
  });

  // Generate HTML for Word
  let contentHtml = `
  <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: '宋体', 'Arial', sans-serif; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid black; padding: 8px; text-align: left; font-size: 10pt; }
        th { background-color: #eee; font-weight: bold; }
        h1 { font-size: 16pt; margin-bottom: 20px; }
        .badge-add { color: green; font-weight: bold; }
        .badge-del { color: red; font-weight: bold; }
        .badge-mod { color: orange; font-weight: bold; }
      </style>
    </head>
    <body>
      <h1 style="text-align:center">项目版本变更差异报告</h1>
      <p><strong>对比版本：</strong> ${oldVersion.versionName} (旧) vs 当前编辑版 (新)</p>
      <p><strong>生成时间：</strong> ${new Date().toLocaleString()}</p>
      
      <table>
        <thead>
          <tr>
            <th style="width: 10%">类型</th>
            <th style="width: 15%">层级</th>
            <th style="width: 25%">位置</th>
            <th style="width: 20%">项目</th>
            <th style="width: 15%">旧值</th>
            <th style="width: 15%">新值</th>
          </tr>
        </thead>
        <tbody>
  `;

  if (changes.length === 0) {
      contentHtml += `<tr><td colspan="6" style="text-align:center; padding: 20px;">未检测到差异</td></tr>`;
  } else {
      changes.forEach(c => {
          let typeClass = '';
          if (c.type === '新增') typeClass = 'badge-add';
          else if (c.type === '删除') typeClass = 'badge-del';
          else typeClass = 'badge-mod';

          contentHtml += `
            <tr>
              <td class="${typeClass}">${c.type}</td>
              <td>${c.level}</td>
              <td>${escapeXml(c.location)}</td>
              <td>${escapeXml(c.item)}</td>
              <td>${escapeXml(c.oldValue)}</td>
              <td>${escapeXml(c.newValue)}</td>
            </tr>
          `;
      });
  }

  contentHtml += `
        </tbody>
      </table>
    </body>
  </html>
  `;

  const blob = new Blob(['\ufeff', contentHtml], { type: 'application/msword' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `ChangeLog_${oldVersion.versionName}_to_Current.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
