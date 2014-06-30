module.exports = function(grunt) {
	grunt.initConfig({
		bump: {
			options: {
				files: ['package.json'],
				updateConfigs: [],
				commit: true,
				commitMessage: 'Release v%VERSION%',
				commitFiles: ['package.json'],
				createTag: false,
				//tagName: 'v%VERSION%',
				//tagMessage: 'Version %VERSION%',
				push: false,
				//pushTo: 'upstream',
				//gitDescribeOptions: '--tags --always --abbrev=1 --dirty=-d'
			}
		},
	})

	grunt.loadNpmTasks('grunt-bump');

	 grunt.registerTask('default', ['bump']);
};