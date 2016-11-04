distname=cloudflow-$(date -u +%y%m%d-%H%M)
zipname=$distname.zip

rm -rf build
gulp
mv build $distname
zip -r $zipname $distname
scp $zipname droplet:cloudflow/dist/
echo http://cloudflow.madeinhaste.org/dist/$zipname

rm $zipname
rm -r $distname
