const APIError = require('../middle/rest').APIError;
const Client = require('ssh2-sftp-client');
const gitApi = require('../plugin/git_api');
const command = require('../plugin/command');
const db = require('../db/git_db');
const path = require('path');
const filePublisher = require('../plugin/filePublisher');

module.exports = {
    // clone项目
    'POST /api/git/clone': async ctx => {
        const body = ctx.request.body;
        const name = body.url.split('/').pop().split('.')[0];
        const isExist = await db.find(name);
        console.log(isExist);
        if(isExist) {
            throw new APIError('controller:clone error', 'repository is existed');
        }
        await gitApi.clone(body.url);
        await db.save({
            repoName: name,
            url: body.url,
            type: body.type
        });
        ctx.rest({
            status: 'success',
            name: body.url.split('/').pop().split('.')[0]
        });
    },
    // 删除一个项目
    'DELETE /api/git/delete/:repo': async ctx => {
        await db.deleteOne(ctx.params.repo);
        // TODO: 删除对应的本地仓库
        command(`rm -rf ./repos/${ctx.params.repo}`);
        // command('rmdir /s/q ' + path.resolve('./repos/' + ctx.params.repo));
        // FIXME: 在对端服务器卸载对应的项目

        ctx.rest({
            status: 'success',
        });
    },
    // 获取所有主项目
    'GET /api/git/getAll': async ctx => {
        ctx.rest({
            status: 'success',
            data: await db.findAllMain()
        });
    },
    // 获取所有专题主项目下的专题子项目
    'GET /api/git/getAllSpecial/:name': async ctx => {

    },
    // 获取当前项目所有提交
    'GET /api/git/commits/:repo': async ctx => {
        // TODO: 获取所有提交
        ctx.rest({
            status: 'success'
        });
    },
    // 发布一个项目
    'POST /api/git/publish': async ctx => {
        const sftp = new Client();
        const body = ctx.request.body;
        const repo = body.repo;
        console.log(body.username, body.password);

        await gitApi.pull(repo, body.username, body.password);
        command('cd ./repos/' + repo + ' && npm install && npm run build');

        await sftp.connect({
            host: '173.254.201.221',
            username: 'elpis',
            password: 'Stranger2012',
        });
        // 删除原有目录
        await sftp.client.shell((err, stream) => {
            stream.end('rm -rf ' + repo);
        });
        // 创建新目录
        await sftp.mkdir(repo);
        await filePublisher(path.resolve('repos/' + repo + '/' + body.dir), sftp, repo + '/');
        await sftp.end();
        ctx.rest({
            status: 'success',
            name: repo
        });
    }
}
