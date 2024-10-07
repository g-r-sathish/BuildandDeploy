const FileSystem = require('fs');
const SyncRequest = require('sync-request');

const config = require('./config');
const Path = require('path');
const sprintf = require('sprintf-js').sprintf;
const util = require('./util');
const {VersionEx} = require('../classes/VersionEx');

var filePathCache = {};

function getArtifactPath (dep) {
  var artifactId = dep.getArtifactId();
  if (config.artifactNameMap[artifactId]) {
    artifactId = config.artifactNameMap[artifactId];
  }
  var groupId = dep.getGroupId();
  return Path.join(dep.getGroupId().replace(/\./g, '/'), artifactId);
}


//http://artifactory.bellevue.agilysys.com/artifactory/libs-release/com/agilysys/pms/root-pom/1.32.0/root-pom-1.32.0.pom
//^---------------------------------------------------------------^ ^-----------------------^ ^----^ ^------^ ^----^
//                         repo url                                     artifactPath          version  artifactId  version

function getReleasedPOMURL (project) {
  var artifactPath = getArtifactPath(project.pom);
  var version = new VersionEx(project.getReleasedVersion());
  var scope = version.isSnapshot() ? 'latest' : 'release';
  var filename = sprintf('%s-%s.pom', project.pom.getArtifactId(), version.toString());
  var path = Path.join(artifactPath, version.toString(), filename);
  var url = version.isSnapshot() ? config.centralRepoUrl : config.releaseRepoUrl;
  url += path;
  return url;
}

function getPublishedPOMURL (dep, version) {
  var artifactPath = getArtifactPath(dep);
  version = version || new VersionEx(dep.getVersion());
  var filename = sprintf('%s-%s.pom', dep.getArtifactId(), version.toString());
  var path = Path.join(artifactPath, version.toString(), filename);
  var url = sprintf("%s%s", version.isSnapshot() ? config.centralRepoUrl : config.releaseRepoUrl, path);
  return url;
}

function fetchPublishedPOM (dep, version) {
  var artifactPath = getArtifactPath(dep);
  version = version || new VersionEx(dep.getVersion());
  var snapshot = version.isSnapshot();
  var scope = snapshot ? 'latest' : 'release';
  var filename = sprintf('%s-%s.pom', dep.getArtifactId(), version.toString());
  var path = Path.join(artifactPath, version.toString(), filename);
  var localPath = Path.join(config.cacheDir, scope, path);

  if (!filePathCache[localPath] && util.fileExists(localPath)) {
    filePathCache[localPath] = true;
  }

  if (!filePathCache[localPath] || config['no-cache']) {
    util.mkfiledir(localPath);
    var url = !snapshot ? config.releaseRepoUrl : config.centralRepoUrl;
    url += path;
    util.narrateln('GET ' + url);
    util.narrateln('--> ' + localPath);
    var content = SyncRequest('GET', url).getBody();
    FileSystem.writeFileSync(localPath, content);
    filePathCache[localPath] = true;
  }

  return localPath;
}

function isArtifactReleased (canonicalId, version) {
  let segments = canonicalId.split(':');
  segments[0] = segments[0].split('.').join('/');
  let artifactPath = segments.join('/');
  let url = sprintf('%s%s/%s/', config.releaseRepoUrl, artifactPath, version.toString());

  util.narratef('HEAD %s\n', url);
  let response = SyncRequest('HEAD', url);
  util.narratef('HTTP %s\n', response.statusCode);
  return response.statusCode === 200;
}

exports.getArtifactPath = getArtifactPath;
exports.getReleasedPOMURL = getReleasedPOMURL;
exports.getPublishedPOMURL = getPublishedPOMURL;
exports.fetchPublishedPOM = fetchPublishedPOM;
exports.isArtifactReleased = isArtifactReleased;
